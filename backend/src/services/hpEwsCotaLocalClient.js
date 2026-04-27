/**
 * Cliente HTTP para a "Configuracao de Cota Local" do EWS de impressoras
 * HP LaserJet Enterprise (FutureSmart).
 *
 * Flow descoberto e validado em HP LaserJet E50145 (firmware OneHP):
 *
 *   1. Login: POST /hp/device/SignIn/Index
 *        agentIdSelect=hp_EmbeddedPin_v1
 *        PinDropDown=AdminItem
 *        PasswordTextBox=<senha>
 *        CSRFToken=<capturado do GET previo>
 *      -> 302 com cookie sessionId
 *
 *   2. Status / leitura: GET /hp/device/LocalQuotaConfiguration/Index
 *      -> HTML que contem tabela com:
 *         <td id="Guest_MonoPrintCredits">307 of 400</td>
 *         <td id="Others_MonoPrintCredits">400 of 400</td>
 *         <td id="Administrator_MonoPrintCredits">400 of 400</td>
 *      -> e checkboxes:
 *         <input id="UserCreditDetailSelect0" value="Guest" .../>
 *         <input id="UserCreditDetailSelect1" value="Others" .../>
 *         <input id="UserCreditDetailSelect2" value="Administrator" .../>
 *
 *   3. Editar creditos de uma conta:
 *      POST /hp/device/LocalQuotaConfiguration/Save com
 *        CSRFToken
 *        LimitReachedAction=Stop
 *        DefaultMonoPrintSidesCredits=<X>
 *        UserCreditDetailSelect{N}=<accountName>
 *        BlackPrintSideCostField=1
 *        EmptyPrintSideCostField=1
 *        UserQuotaInfoEditButton=Edit...
 *      -> 302 Location: /hp/device/UserQuotaInfoEdit/Index?id=<uuid>&...
 *      GET dessa URL retorna form com:
 *        EditMonoPrintSidesCreditsField=<creditos atuais>
 *      POST /hp/device/UserQuotaInfoEdit/Save com:
 *        CSRFToken
 *        LimitReachedAction=Stop
 *        EditMonoPrintSidesCreditsField=<NOVOS_CREDITOS>
 *        FormButtonSubmit=OK
 *
 *   4. Reset (zera "uso", volta creditos pro maximo):
 *      POST /hp/device/LocalQuotaConfiguration/Save com UserQuotaInfoResetButton=Reset...
 *      -> 302 Location: /hp/device/UserQuotaInfoReset/Index?id=<uuid>
 *      GET retorna confirmacao
 *      POST /hp/device/UserQuotaInfoReset/Save com FormResetConfirmationButton=Reset
 *
 * Modelos de outras frotas (LaserJet Pro, M-series antigos) podem ter um fluxo
 * diferente; por enquanto suportamos so o FutureSmart. A funcao detectStrategy
 * pode ser estendida para outras estrategias mais tarde.
 */
const { fetch, Agent } = require('undici');

const EWS_USERNAME = process.env.EWS_USERNAME || 'admin';
const EWS_PASSWORD = process.env.EWS_PASSWORD || '';
const TLS_REJECT = String(process.env.EWS_TLS_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const REQUEST_TIMEOUT_MS = Number(process.env.EWS_TIMEOUT_MS || 10000);

const dispatcher = new Agent({
  connect: { rejectUnauthorized: TLS_REJECT },
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
});

// Cache simples por IP: { protocol, cookie, csrf, userMap }
const sessionCache = new Map();

function safeText(html, max = 200) {
  return (html || '').replace(/\s+/g, ' ').slice(0, max);
}

function mergeCookies(prev, setCookieHeaders) {
  const jar = {};
  if (prev) {
    for (const part of prev.split(';')) {
      const [k, v] = part.split('=').map(s => s && s.trim());
      if (k) jar[k] = v;
    }
  }
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : (setCookieHeaders ? [setCookieHeaders] : []);
  for (const sc of arr) {
    const first = sc.split(';')[0];
    const [k, v] = first.split('=').map(s => s && s.trim());
    if (k) jar[k] = v;
  }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function buildHeaders(session, extra = {}) {
  const headers = {
    'User-Agent': 'PrintingAutomation/1.0',
    ...extra,
  };
  if (session.cookie) headers['Cookie'] = session.cookie;
  return headers;
}

async function httpReq(session, urlPath, opts = {}) {
  const url = urlPath.startsWith('http') ? urlPath : session.baseUrl + urlPath;
  const headers = buildHeaders(session, opts.headers || {});
  if (opts.referer) headers['Referer'] = opts.referer;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
    dispatcher,
    redirect: opts.followRedirect === true ? 'follow' : 'manual',
  });
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  const sc = res.headers.getSetCookie?.() || res.headers.get('set-cookie');
  if (sc) session.cookie = mergeCookies(session.cookie, sc);
  return { status: res.status, location: res.headers.get('location'), body, finalUrl: res.url };
}

async function detectProtocol(ip) {
  for (const proto of ['https://', 'http://']) {
    try {
      const res = await fetch(proto + ip + '/', { dispatcher, redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return proto;
    } catch { /* try next */ }
  }
  throw new Error(`Sem resposta HTTP/HTTPS em ${ip}`);
}

function extractCsrf(html) {
  return /name="CSRFToken"[^>]*value="([^"]+)"/i.exec(html || '')?.[1] || null;
}

// Best-effort signout: HP FutureSmart aceita GET em /hp/device/SignOut/Index
// para encerrar sessao admin previa. Usado para destravar 409 Conflict.
async function tryForceSignout(session) {
  try {
    await httpReq(session, '/hp/device/SignOut/Index');
  } catch { /* ignore */ }
  try {
    await httpReq(session, '/hp/device/SignOut/Action.aspx');
  } catch { /* ignore */ }
  // Limpa cookies da sessao atual para o proximo SignIn comecar limpo
  session.cookie = '';
}

async function doLoginRequest(session) {
  // GET prepara cookie e CSRF
  const get = await httpReq(session, '/hp/device/SignIn/Index');
  if (get.status >= 400) {
    throw new Error(`SignIn GET status ${get.status}`);
  }
  const csrf = extractCsrf(get.body);
  if (!csrf) throw new Error('CSRFToken nao encontrado em SignIn/Index');

  const form = new URLSearchParams();
  form.set('CSRFToken', csrf);
  form.set('agentIdSelect', 'hp_EmbeddedPin_v1');
  form.set('PinDropDown', 'AdminItem');
  form.set('PasswordTextBox', EWS_PASSWORD);
  form.set('signInOk', 'Login');

  const post = await httpReq(session, '/hp/device/SignIn/Index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': session.baseUrl },
    body: form,
    referer: session.baseUrl + '/hp/device/SignIn/Index',
  });

  return post;
}

// Login HP FutureSmart: GET /hp/device/SignIn/Index pra capturar CSRF+cookie,
// depois POST com agentIdSelect/PinDropDown/PasswordTextBox.
//
// Trata especificamente status 409 (Conflict): a HP FutureSmart retorna 409
// quando ja existe outra sessao admin ativa (aba aberta no navegador, sessao
// presa de chamada anterior). Tentamos forcar signout e refazer login.
async function login(session) {
  let post = await doLoginRequest(session);

  // Login OK = 302 e Location nao volta pra SignIn
  if (post.status === 302 && post.location && !/SignIn/i.test(post.location)) {
    return true;
  }

  // 409 = sessao admin concorrente. Tenta forcar signout e relogar 1x.
  if (post.status === 409) {
    await tryForceSignout(session);
    await new Promise(r => setTimeout(r, 1500)); // a HP precisa de tempinho
    post = await doLoginRequest(session);
    if (post.status === 302 && post.location && !/SignIn/i.test(post.location)) {
      return true;
    }
    // Continua 409 - sessao trancada por um navegador externo
    if (post.status === 409) {
      throw new Error(
        'Outra sessao admin esta ativa no EWS desta impressora. ' +
        'Feche todas as abas do EWS no navegador e aguarde 1 minuto antes de tentar novamente.'
      );
    }
  }

  // Senha errada normalmente retorna 200 com a propria pagina de login de novo
  throw new Error(`Login falhou: status=${post.status} location=${post.location || '(none)'} title="${safeText(post.body, 80)}"`);
}

async function ensureSession(ip) {
  const cached = sessionCache.get(ip);
  if (cached && cached.cookie) return cached;

  const protocol = await detectProtocol(ip);
  const session = {
    ip,
    protocol,
    baseUrl: protocol + ip,
    cookie: '',
    userMap: null,
  };
  await login(session);
  sessionCache.set(ip, session);
  return session;
}

// Re-faz login se a session expirou
async function callWithRetry(ip, fn) {
  let session = await ensureSession(ip);
  try {
    return await fn(session);
  } catch (err) {
    if (/login|sign[\s-]?in|401|403|sessao/i.test(err.message)) {
      sessionCache.delete(ip);
      session = await ensureSession(ip);
      return await fn(session);
    }
    throw err;
  }
}

// --- Parsing da pagina LocalQuotaConfiguration ---

// Faz parse do HTML pra extrair estado atual e mapa de checkbox
function parseQuotaPage(html) {
  const csrf = extractCsrf(html);

  // Mapa: accountName -> { checkboxName, checkboxValue, currentCredits, limit, action }
  const userMap = {};

  // Captura cada <input type="checkbox" ... id="UserCreditDetailSelectN" ... value="<account>" ... />
  // (atributos podem vir em qualquer ordem). HP usa name == id nesse caso.
  const inputRe = /<input\b([^>]*)\/?>/gi;
  let cm;
  while ((cm = inputRe.exec(html)) !== null) {
    const attrs = cm[1];
    const idMatch = /\bid="(UserCreditDetailSelect\d+)"/i.exec(attrs);
    if (!idMatch) continue;
    const valueMatch = /\bvalue="([^"]+)"/i.exec(attrs);
    if (!valueMatch) continue;
    const checkboxName = idMatch[1];
    const accountName = valueMatch[1];
    if (accountName === 'ALL' || accountName === 'on') continue;
    userMap[accountName] = { checkboxName, accountName, current: null, limit: null, action: null };
  }

  // Layout A (firmware antigo OneHP): <td id="Guest_MonoPrintCredits">307 of 400</td>
  const creditsRe = /<td[^>]*id="([A-Za-z0-9_]+)_MonoPrintCredits"[^>]*>\s*(-?\d+)\s+of\s+(-?\d+)\s*<\/td>/gi;
  let mm;
  while ((mm = creditsRe.exec(html)) !== null) {
    const account = mm[1];
    if (userMap[account]) {
      userMap[account].current = parseInt(mm[2], 10);
      userMap[account].limit = parseInt(mm[3], 10);
    }
  }

  // Layout A: <td id="Guest_LimitReachedAction">Stop</td>
  const actionRe = /<td[^>]*id="([A-Za-z0-9_]+)_LimitReachedAction"[^>]*>\s*([A-Za-z]+)\s*<\/td>/gi;
  let am;
  while ((am = actionRe.exec(html)) !== null) {
    const account = am[1];
    if (userMap[account]) userMap[account].action = am[2];
  }

  // Layout B/C (firmware mais recente FutureSmart):
  //   <tbody id="UserQuotaTableBody">
  //     <tr id="UserQuota_0">
  //       <td><input id="UserCreditDetailSelect0" value="Guest" .../></td>
  //       <td id="Guest">Guest</td>
  //       [Layout C apenas, quando "Combinar creditos" esta ON na pagina:]
  //       <td class="a_CombinedMonoCredits">340 of 348</td>
  //       [Layout B/C sempre]:
  //       <td class="Def_MonoPrintCredits">46 of 300</td>  (= 0/0 em Layout C)
  //       <td class="Def_LimitReachedAction">Stop</td>
  //     </tr>
  //
  // Layout C: quando "Combinar creditos" esta ativado na impressora, os
  // campos individuais (Def_MonoPrintCredits) ficam ZERADOS e o valor real
  // fica em a_CombinedMonoCredits. Por isso preferimos a_CombinedMonoCredits
  // quando ele aparecer.
  //
  // Layout A (id="Guest_MonoPrintCredits") tem prioridade pois e o mais
  // confiavel; so preenche aqui o que faltou.
  const tbodyMatch = /<tbody[^>]*id="UserQuotaTableBody"[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  if (tbodyMatch) {
    const tbody = tbodyMatch[1];
    const blocks = tbody.split(/(?=<tr\b[^>]*id="UserQuota_\d+")/);
    for (const blk of blocks) {
      if (!/UserQuota_\d+/.test(blk)) continue;
      const cb = /<input\b[^>]*\bid="UserCreditDetailSelect\d+"[^>]*\bvalue="([^"]+)"/i.exec(blk)
              || /<input\b[^>]*\bvalue="([^"]+)"[^>]*\bid="UserCreditDetailSelect\d+"/i.exec(blk);
      if (!cb) continue;
      const account = cb[1];
      if (account === 'ALL' || account === 'on') continue;
      const u = userMap[account];
      if (!u) continue;
      if (u.current === null || u.limit === null) {
        // Layout C tem prioridade: a_CombinedMonoCredits e o valor REAL
        // quando "Combinar creditos" esta ativado.
        const cCombined = /<td[^>]*class="[^"]*a_CombinedMonoCredits[^"]*"[^>]*>\s*(-?\d+)\s+of\s+(-?\d+)\s*<\/td>/i.exec(blk);
        const cMono = /<td[^>]*class="[^"]*Def_MonoPrintCredits[^"]*"[^>]*>\s*(-?\d+)\s+of\s+(-?\d+)\s*<\/td>/i.exec(blk);

        // Heuristica: se Combined existir e Mono for 0/0, Combined eh o valor real.
        // Se Mono tiver valor positivo, Mono eh o valor real (combinar OFF).
        const useCombined = cCombined && (
          !cMono ||
          (parseInt(cMono[2], 10) === 0)
        );
        const chosen = useCombined ? cCombined : cMono;
        if (chosen) {
          u.current = parseInt(chosen[1], 10);
          u.limit = parseInt(chosen[2], 10);
        }
      }
      if (u.action === null) {
        const a = /<td[^>]*class="[^"]*Def_LimitReachedAction[^"]*"[^>]*>\s*([A-Za-z]+)\s*<\/td>/i.exec(blk);
        if (a) u.action = a[1];
      }
    }
  }

  // Defaults da pagina
  const defaultCreditsRe = /<input[^>]*id="DefaultMonoPrintSidesCredits"[^>]*value="(\d+)"/i;
  const defaultActionRe = /<select[^>]*id="LimitReachedAction"[^>]*>([\s\S]*?)<\/select>/i;
  const defaultCredits = parseInt(defaultCreditsRe.exec(html)?.[1] || '0', 10);
  let defaultAction = 'Stop';
  const sel = defaultActionRe.exec(html)?.[1];
  if (sel) {
    const opt = /<option[^>]*value="([^"]+)"[^>]*selected/i.exec(sel);
    if (opt) defaultAction = opt[1];
  }
  const blackCost = parseInt(/<input[^>]*id="BlackPrintSideCostField"[^>]*value="(\d+)"/i.exec(html)?.[1] || '1', 10);
  const emptyCost = parseInt(/<input[^>]*id="EmptyPrintSideCostField"[^>]*value="(\d+)"/i.exec(html)?.[1] || '1', 10);

  return { csrf, userMap, defaultCredits, defaultAction, blackCost, emptyCost };
}

// Aliases PT-BR <-> EN para nomes de conta. As impressoras HP FutureSmart
// internamente usam IDs em ingles (Guest/Others/Administrator), mesmo quando
// o EWS exibe labels em portugues (Convidado/Outros/Administrador).
const ACCOUNT_ALIASES = {
  'Guest': ['Guest', 'Convidado'],
  'Others': ['Others', 'Outros'],
  'Administrator': ['Administrator', 'Administrador'],
};

function resolveAccount(userMap, requestedName) {
  if (userMap[requestedName]) return userMap[requestedName];
  // Tenta aliases
  const lower = requestedName.toLowerCase();
  for (const [canonical, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === lower)) {
      if (userMap[canonical]) return userMap[canonical];
      // procura qualquer chave que case com aliases
      for (const key of Object.keys(userMap)) {
        if (aliases.some(a => a.toLowerCase() === key.toLowerCase())) {
          return userMap[key];
        }
      }
    }
  }
  // fallback case-insensitive direto
  for (const key of Object.keys(userMap)) {
    if (key.toLowerCase() === lower) return userMap[key];
  }
  return null;
}

async function loadQuotaPage(session) {
  const r = await httpReq(session, '/hp/device/LocalQuotaConfiguration/Index');
  if (r.status !== 200) {
    throw new Error(`LocalQuotaConfiguration/Index status ${r.status}: ${safeText(r.body, 100)}`);
  }
  const parsed = parseQuotaPage(r.body);
  if (!parsed.csrf) throw new Error('CSRFToken ausente na pagina de cota');
  if (Object.keys(parsed.userMap).length === 0) {
    throw new Error('Nenhuma conta de cota encontrada na pagina (modelo nao suportado?)');
  }
  return parsed;
}

// --- Operacoes de alto nivel ---

async function getStatus(ip) {
  return await callWithRetry(ip, async (session) => {
    const page = await loadQuotaPage(session);
    return {
      success: true,
      defaults: {
        credits: page.defaultCredits,
        action: page.defaultAction,
        blackCost: page.blackCost,
        emptyCost: page.emptyCost,
      },
      accounts: Object.values(page.userMap).map(u => ({
        name: u.accountName,
        current: u.current,
        limit: u.limit,
        action: u.action,
      })),
    };
  });
}

// Faz parse de todos os <input type="text"|"hidden"> de um form HTML.
// Retorna objeto { name -> value } para preservar campos no POST.
function parseFormInputs(html) {
  const out = {};
  const inputs = [...html.matchAll(/<input\b([^>]*?)\/?>(?!\s*<\/option>)/gi)];
  for (const m of inputs) {
    const attrs = m[1];
    const type = (/\btype="([^"]*)"/i.exec(attrs)?.[1] || 'text').toLowerCase();
    if (!['text', 'hidden', 'number', 'password'].includes(type)) continue;
    const name = /\bname="([^"]+)"/i.exec(attrs)?.[1];
    if (!name) continue;
    const value = /\bvalue="([^"]*)"/i.exec(attrs)?.[1] ?? '';
    out[name] = value;
  }
  // Selects: pega option selected
  const selects = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
  for (const m of selects) {
    const name = /\bname="([^"]+)"/i.exec(m[1])?.[1];
    if (!name) continue;
    const sel = /<option[^>]*\bvalue="([^"]*)"[^>]*\bselected[^>]*>/i.exec(m[2])
              || /<option[^>]*\bselected[^>]*\bvalue="([^"]*)"/i.exec(m[2]);
    out[name] = sel?.[1] ?? '';
  }
  return out;
}

// Edita o LIMITE de creditos de uma conta especifica, tolerante aos 3 layouts
// de firmware (A/B/C). O campo de limite efetivo depende do firmware:
//   - Layout A/B (combinar OFF): EditMonoPrintSidesCreditsField
//   - Layout C   (combinar ON):  EditMonoCombinedCredits + EditBlackCopyCredits
//
// Estrategia: depois de abrir a pagina de Edit, lemos TODOS os inputs do form
// e preservamos seus valores. Sobrescrevemos apenas LimitReachedAction e o(s)
// campo(s) de limite identificados pelo layout.
//
// account: nome exato (ex: 'Guest') ou alias PT-BR (ex: 'Convidado')
// credits: novo valor de LIMITE (0 a 999999)
// action: 'Stop' (default) ou 'Finish'
async function setUserQuota(ip, account, credits, action = 'Stop') {
  if (!Number.isFinite(credits) || credits < 0 || credits > 999999) {
    throw new Error(`creditos invalidos: ${credits}`);
  }
  if (!['Stop', 'Finish'].includes(action)) {
    throw new Error(`action invalida: ${action}`);
  }

  return await callWithRetry(ip, async (session) => {
    const page = await loadQuotaPage(session);
    const user = resolveAccount(page.userMap, account);
    if (!user) {
      throw new Error(`Conta "${account}" nao existe nesta impressora. Disponiveis: ${Object.keys(page.userMap).join(', ')}`);
    }

    // 1. Clicar em Edit... -> 302 com URL de edicao
    const form1 = new URLSearchParams();
    form1.set('CSRFToken', page.csrf);
    form1.set('LimitReachedAction', page.defaultAction);
    form1.set('DefaultMonoPrintSidesCredits', String(page.defaultCredits));
    form1.set(user.checkboxName, user.accountName);
    form1.set('BlackPrintSideCostField', String(page.blackCost));
    form1.set('EmptyPrintSideCostField', String(page.emptyCost));
    form1.set('UserQuotaInfoEditButton', 'Edit...');

    const r1 = await httpReq(session, '/hp/device/LocalQuotaConfiguration/Save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': session.baseUrl },
      body: form1,
      referer: session.baseUrl + '/hp/device/LocalQuotaConfiguration/Index',
    });
    if (r1.status !== 302 || !r1.location) {
      throw new Error(`Edit step 1 falhou: status=${r1.status} body="${safeText(r1.body, 100)}"`);
    }

    // 2. GET na URL de edicao pra capturar novo CSRF + parse do form
    const editUrl = r1.location.startsWith('http') ? r1.location : (r1.location.startsWith('/') ? r1.location : '/' + r1.location);
    const r2 = await httpReq(session, editUrl);
    if (r2.status !== 200) {
      throw new Error(`Edit step 2 falhou: status=${r2.status}`);
    }
    const csrf2 = extractCsrf(r2.body);
    if (!csrf2) throw new Error('CSRFToken ausente na pagina de Edit');
    const refererEdit = session.baseUrl + (editUrl.startsWith('http') ? new URL(editUrl).pathname + new URL(editUrl).search : editUrl);

    // Parse de todos os inputs/selects do form de Edit (preservar valores).
    const fields = parseFormInputs(r2.body);
    fields['CSRFToken'] = csrf2;
    fields['LimitReachedAction'] = action;
    fields['FormButtonSubmit'] = 'OK';

    // Determina layout e quais campos sobrescrever.
    // Layout C: tem EditMonoCombinedCredits (campo principal). Tambem precisa
    //   atualizar EditBlackCopyCredits com o mesmo valor.
    // Layout A/B: usa EditMonoPrintSidesCreditsField.
    const layoutC = ('EditMonoCombinedCredits' in fields);
    let mainFieldsSet = [];
    if (layoutC) {
      fields['EditMonoCombinedCredits'] = String(credits);
      if ('EditBlackCopyCredits' in fields) fields['EditBlackCopyCredits'] = String(credits);
      mainFieldsSet = ['EditMonoCombinedCredits', 'EditBlackCopyCredits'].filter(k => k in fields);
    } else if ('EditMonoPrintSidesCreditsField' in fields) {
      fields['EditMonoPrintSidesCreditsField'] = String(credits);
      mainFieldsSet = ['EditMonoPrintSidesCreditsField'];
    } else {
      throw new Error(`Edit form sem campo de credits conhecido. Inputs: ${Object.keys(fields).join(',')}`);
    }

    // Monta body do POST preservando ordem (URLSearchParams).
    const form2 = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) {
      if (k === '-' || k === 'globalSearch') continue;
      form2.set(k, String(v));
    }

    // 3. POST UserQuotaInfoEdit/Save
    const r3 = await httpReq(session, '/hp/device/UserQuotaInfoEdit/Save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': session.baseUrl },
      body: form2,
      referer: refererEdit,
    });

    if (r3.status === 302) {
      return {
        success: true,
        account: user.accountName,
        requestedAs: account,
        previousCurrent: user.current,
        previousLimit: user.limit,
        newLimit: credits,
        action,
        layout: layoutC ? 'C' : 'A/B',
        fieldsUpdated: mainFieldsSet,
      };
    }
    throw new Error(`Edit step 3 falhou: status=${r3.status} body="${safeText(r3.body, 100)}"`);
  });
}

// Aplica uma lista de updates ([{ account, credits, action? }, ...])
async function setUserQuotaBatch(ip, entries) {
  const results = [];
  for (const e of entries) {
    try {
      const r = await setUserQuota(ip, e.account, e.credits, e.action || 'Stop');
      results.push(r);
    } catch (err) {
      results.push({ success: false, account: e.account, error: err.message });
    }
  }
  return { success: results.every(r => r.success), results };
}

// Reset zera o "uso" e volta creditos pro limite (current = limit)
async function resetUserQuota(ip, account) {
  return await callWithRetry(ip, async (session) => {
    const page = await loadQuotaPage(session);
    const user = resolveAccount(page.userMap, account);
    if (!user) {
      throw new Error(`Conta "${account}" nao existe. Disponiveis: ${Object.keys(page.userMap).join(', ')}`);
    }

    const form1 = new URLSearchParams();
    form1.set('CSRFToken', page.csrf);
    form1.set('LimitReachedAction', page.defaultAction);
    form1.set('DefaultMonoPrintSidesCredits', String(page.defaultCredits));
    form1.set(user.checkboxName, user.accountName);
    form1.set('BlackPrintSideCostField', String(page.blackCost));
    form1.set('EmptyPrintSideCostField', String(page.emptyCost));
    form1.set('UserQuotaInfoResetButton', 'Reset...');

    const r1 = await httpReq(session, '/hp/device/LocalQuotaConfiguration/Save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': session.baseUrl },
      body: form1,
      referer: session.baseUrl + '/hp/device/LocalQuotaConfiguration/Index',
    });
    if (r1.status !== 302 || !r1.location) {
      throw new Error(`Reset step 1 falhou: status=${r1.status}`);
    }

    const confirmUrl = r1.location.startsWith('http') ? r1.location : (r1.location.startsWith('/') ? r1.location : '/' + r1.location);
    const r2 = await httpReq(session, confirmUrl);
    if (r2.status !== 200) {
      throw new Error(`Reset step 2 falhou: status=${r2.status}`);
    }
    const csrf2 = extractCsrf(r2.body);
    if (!csrf2) throw new Error('CSRFToken ausente na pagina de confirmacao do Reset');

    const form2 = new URLSearchParams();
    form2.set('CSRFToken', csrf2);
    form2.set('FormResetConfirmationButton', 'Reset');

    const r3 = await httpReq(session, '/hp/device/UserQuotaInfoReset/Save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': session.baseUrl },
      body: form2,
      referer: session.baseUrl + (confirmUrl.startsWith('http') ? new URL(confirmUrl).pathname + new URL(confirmUrl).search : confirmUrl),
    });
    if (r3.status === 302) {
      return { success: true, account: user.accountName, requestedAs: account };
    }
    throw new Error(`Reset step 3 falhou: status=${r3.status}`);
  });
}

function clearSessionCache(ip) {
  if (ip) sessionCache.delete(ip);
  else sessionCache.clear();
}

module.exports = {
  getStatus,
  setUserQuota,
  setUserQuotaBatch,
  resetUserQuota,
  clearSessionCache,
  EWS_USERNAME,
};
