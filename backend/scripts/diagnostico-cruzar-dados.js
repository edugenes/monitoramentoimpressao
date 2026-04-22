/**
 * Cruza dados de tres fontes para auditar quais impressoras estao certas:
 *  1) Banco do sistema       (tabela printers + quotas)
 *  2) Relatorio Simpress     (serie + IP + contador 01/04/2026)
 *  3) Relatorio HSE          (serie + setor HSE + cota proposta)
 *
 * Chave de cruzamento: Numero de Serie (normalizado uppercase).
 *
 * Uso:
 *   node scripts/diagnostico-cruzar-dados.js "<simpress.xlsx>" "<hse.xlsx>"
 */
const XLSX = require('xlsx');
const db = require('../src/config/db');

const SIMPRESS_PATH = process.argv[2];
const HSE_PATH = process.argv[3];

if (!SIMPRESS_PATH || !HSE_PATH) {
  console.error('Uso: node scripts/diagnostico-cruzar-dados.js "<simpress.xlsx>" "<hse.xlsx>"');
  process.exit(1);
}

// ---------- SIMPRESS ----------
// Colunas: 0=Contrato, 2=Serie, 3=IP, 6=Apelido, 14..17=Contadores, 22=Data
const simpress = {};
{
  const wb = XLSX.readFile(SIMPRESS_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const serie = String(r[2]).trim().toUpperCase();
    const ip = r[3] ? String(r[3]).trim() : '';
    const apelido = r[6] ? String(r[6]).trim() : '';
    const pbA4 = Number(r[14]) || 0;
    const colorA4 = Number(r[15]) || 0;
    const pbA3 = Number(r[16]) || 0;
    const colorA3 = Number(r[17]) || 0;
    const contador = pbA4 + colorA4 + pbA3 + colorA3;
    const dataLeitura = r[22];
    simpress[serie] = { serie, ip, apelido, contador, dataLeitura };
  }
}

// ---------- HSE ----------
// Colunas na aba "Situacao Atual": 0=Item, 1=Serie, 2=SETOR, 3=Modelo, ..., 10=Cota Proposta
const hse = {};
{
  const wb = XLSX.readFile(HSE_PATH);
  const ws = wb.Sheets['Situação Atual'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1]) continue;
    const serie = String(r[1]).trim().toUpperCase();
    const setor = r[2] ? String(r[2]).trim() : '';
    const modelo = r[3] ? String(r[3]).trim() : '';
    const cotaProposta = Number(r[10]) || 0;
    hse[serie] = { serie, setor, modelo, cotaProposta };
  }
}

// ---------- SISTEMA ----------
const sistema = db.prepare(`
  SELECT p.id, p.name, p.ip_address, p.serial_number, p.active,
         s.name AS setor_name,
         q.monthly_limit, q.current_usage,
         (SELECT COALESCE(SUM(amount), 0) FROM releases WHERE quota_id = q.id) AS total_released
  FROM printers p
  LEFT JOIN sectors s ON p.sector_id = s.id
  LEFT JOIN quotas q ON q.printer_id = p.id AND q.period = '2026-04'
  WHERE p.active = 1
  ORDER BY p.name
`).all();

// Constroi indice do sistema por IP e por serie (se a coluna serial_number existir)
const sistemaPorIp = {};
const sistemaPorSerie = {};
for (const p of sistema) {
  if (p.ip_address) sistemaPorIp[p.ip_address.trim()] = p;
  if (p.serial_number) sistemaPorSerie[p.serial_number.trim().toUpperCase()] = p;
}

// ---------- ESTATISTICAS GERAIS ----------
console.log('\n==================== ESTATISTICAS ====================');
console.log(`Simpress (linhas com serie): ${Object.keys(simpress).length}`);
console.log(`HSE      (linhas com serie): ${Object.keys(hse).length}`);
console.log(`Sistema  (impressoras ativas): ${sistema.length}`);
console.log('======================================================\n');

// ---------- AUDITORIA POR SERIE ----------
// Unifica todas as series
const todasSeries = new Set([
  ...Object.keys(simpress),
  ...Object.keys(hse),
]);

const relatorio = [];
for (const serie of todasSeries) {
  const s = simpress[serie];
  const h = hse[serie];
  if (!s && !h) continue;

  // Tentar achar no sistema:
  // 1) pela serie (se a coluna existir)
  // 2) pelo IP do Simpress
  // 3) pelo nome (apelido Simpress ou setor HSE)
  let sys = sistemaPorSerie[serie] || null;
  let matchBy = sys ? 'serie' : '';

  if (!sys && s && s.ip) {
    sys = sistemaPorIp[s.ip];
    if (sys) matchBy = 'ip';
  }

  if (!sys && h && h.setor) {
    const alvo = h.setor.toLowerCase();
    sys = sistema.find(p =>
      (p.name || '').toLowerCase() === alvo ||
      (p.setor_name || '').toLowerCase() === alvo
    );
    if (sys) matchBy = 'nome/setor';
  }

  relatorio.push({
    serie,
    simpress: s,
    hse: h,
    sys,
    matchBy,
  });
}

// ---------- 1) IMPRESSORAS EM AMBOS OS RELATORIOS MAS NAO NO SISTEMA ----------
console.log('\n==== IMPRESSORAS DO HSE QUE NAO ACHAMOS NO SISTEMA ====');
const naoNoSistema = relatorio.filter(r => r.hse && !r.sys);
if (naoNoSistema.length === 0) {
  console.log('  (nenhuma)');
} else {
  for (const r of naoNoSistema) {
    const ip = r.simpress?.ip || '?';
    const apelido = r.simpress?.apelido || '';
    console.log(`  SERIE ${r.serie.padEnd(12)} | IP ${ip.padEnd(16)} | HSE: ${r.hse.setor} | Apelido Simpress: ${apelido}`);
  }
}

// ---------- 2) IMPRESSORAS DO SISTEMA COM IP DIFERENTE DO SIMPRESS ----------
console.log('\n==== IMPRESSORAS COM IP DIVERGENTE ENTRE SISTEMA e SIMPRESS ====');
const ipDivergente = [];
for (const r of relatorio) {
  if (!r.sys || !r.simpress) continue;
  const ipSys = (r.sys.ip_address || '').trim();
  const ipSimpress = (r.simpress.ip || '').trim();
  if (ipSys && ipSimpress && ipSys !== ipSimpress) {
    ipDivergente.push(r);
  }
}
if (ipDivergente.length === 0) {
  console.log('  (nenhuma divergencia de IP)');
} else {
  for (const r of ipDivergente) {
    console.log(`  SERIE ${r.serie.padEnd(12)} | Sistema: ${r.sys.name} / IP ${r.sys.ip_address} | Simpress: ${r.simpress.apelido} / IP ${r.simpress.ip}`);
  }
}

// ---------- 3) AUDITORIA FINAL: serie do sistema x uso esperado ----------
console.log('\n==== CONFERENCIA DE USO: SISTEMA x SIMPRESS ====');
console.log('(Comparacao entre o uso calculado pelo sistema e o esperado com base no contador do Simpress 01/04)\n');

const stmtGetLatest = db.prepare(`
  SELECT page_count FROM snmp_readings
  WHERE printer_id = ?
  ORDER BY created_at DESC LIMIT 1
`);

const usoDivergente = [];
for (const r of relatorio) {
  if (!r.sys || !r.simpress) continue;
  const latest = stmtGetLatest.get(r.sys.id);
  if (!latest) continue;
  const baselineReal = r.simpress.contador;
  const usoReal = Math.max(latest.page_count - baselineReal, 0);
  const usoSistema = r.sys.current_usage || 0;
  const diff = usoReal - usoSistema;
  if (Math.abs(diff) > 5) { // tolerancia
    usoDivergente.push({
      serie: r.serie,
      sys: r.sys,
      simpress: r.simpress,
      latest: latest.page_count,
      baselineReal,
      usoReal,
      usoSistema,
      diff,
    });
  }
}

if (usoDivergente.length === 0) {
  console.log('  (nenhuma divergencia grande de uso)');
} else {
  console.log('  Nome'.padEnd(35) + 'IP'.padEnd(18) + 'Serie'.padEnd(14) + 'Baseline'.padEnd(10) + 'Atual'.padEnd(10) + 'UsoReal'.padEnd(10) + 'UsoSys'.padEnd(10) + 'Diff');
  console.log('  ' + '-'.repeat(130));
  usoDivergente.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  for (const r of usoDivergente.slice(0, 30)) {
    console.log(
      '  ' +
      (r.sys.name || '-').substring(0, 33).padEnd(35) +
      (r.sys.ip_address || '-').padEnd(18) +
      r.serie.padEnd(14) +
      String(r.baselineReal).padEnd(10) +
      String(r.latest).padEnd(10) +
      String(r.usoReal).padEnd(10) +
      String(r.usoSistema).padEnd(10) +
      String(r.diff)
    );
  }
  if (usoDivergente.length > 30) {
    console.log(`\n  ... e mais ${usoDivergente.length - 30} linhas com divergencia.`);
  }
}

// ---------- 4) IMPRESSORAS DO SISTEMA SEM CORRESPONDENCIA ----------
console.log('\n==== IMPRESSORAS DO SISTEMA SEM SERIE CONHECIDA EM NENHUM RELATORIO ====');
const seriesValidas = new Set(Object.keys(simpress).concat(Object.keys(hse)));
const orfas = [];
for (const p of sistema) {
  const serie = p.serial_number ? p.serial_number.trim().toUpperCase() : null;
  const ip = (p.ip_address || '').trim();

  // Ja esta nos relatorios?
  let achou = false;
  if (serie && seriesValidas.has(serie)) achou = true;
  if (!achou && ip) {
    for (const s of Object.values(simpress)) if (s.ip === ip) { achou = true; break; }
  }
  if (!achou) orfas.push(p);
}

if (orfas.length === 0) {
  console.log('  (todas as impressoras do sistema foram casadas com algum relatorio)');
} else {
  for (const p of orfas) {
    console.log(`  ${(p.name || '-').padEnd(30)} | IP ${(p.ip_address || '-').padEnd(16)} | Serie: ${p.serial_number || '(nao cadastrada)'}`);
  }
}

console.log('\n==================== FIM =====================\n');
process.exit(0);
