/**
 * Compara, lado a lado, a COTA mensal de cada impressora entre:
 *   - Sistema       (quotas.monthly_limit para o periodo 2026-04)
 *   - Relatorio HSE (coluna "Cota Proposta")
 *
 * Mostra tambem o contador do Simpress em 01/04 para referencia visual.
 *
 * NAO ALTERA NADA. Apenas imprime o relatorio.
 *
 * Chave de cruzamento: Numero de Serie (normalizado uppercase).
 *
 * Uso:
 *   node scripts/comparar-cotas.js "<simpress.xlsx>" "<hse.xlsx>"
 */
const XLSX = require('xlsx');
const db = require('../src/config/db');

const SIMPRESS_PATH = process.argv[2];
const HSE_PATH = process.argv[3];

if (!SIMPRESS_PATH || !HSE_PATH) {
  console.error('Uso: node scripts/comparar-cotas.js "<simpress.xlsx>" "<hse.xlsx>"');
  process.exit(1);
}

// ---------- SIMPRESS ----------
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
    const contador =
      (Number(r[14]) || 0) +
      (Number(r[15]) || 0) +
      (Number(r[16]) || 0) +
      (Number(r[17]) || 0);
    simpress[serie] = { serie, ip, apelido, contador };
  }
}

// ---------- HSE ----------
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
    const cotaProposta = Number(r[10]) || 0;
    hse[serie] = { serie, setor, cotaProposta };
  }
}

// ---------- SISTEMA ----------
const sistema = db.prepare(`
  SELECT p.id, p.name, p.ip_address, p.serial_number, p.active,
         s.name AS setor_name,
         q.monthly_limit, q.current_usage
  FROM printers p
  LEFT JOIN sectors s ON p.sector_id = s.id
  LEFT JOIN quotas q ON q.printer_id = p.id AND q.period = '2026-04'
  WHERE p.active = 1
  ORDER BY p.name
`).all();

const sistemaPorIp = {};
const sistemaPorSerie = {};
for (const p of sistema) {
  if (p.ip_address) sistemaPorIp[p.ip_address.trim()] = p;
  if (p.serial_number) sistemaPorSerie[p.serial_number.trim().toUpperCase()] = p;
}

// ---------- CRUZAMENTO ----------
function acharNoSistema(serie, s) {
  let sys = sistemaPorSerie[serie] || null;
  if (!sys && s && s.ip) sys = sistemaPorIp[s.ip] || null;
  return sys;
}

const linhas = [];
for (const serie of Object.keys(hse)) {
  const h = hse[serie];
  const s = simpress[serie] || null;
  const sys = acharNoSistema(serie, s);

  linhas.push({
    serie,
    nomeSistema: sys ? sys.name : '(nao encontrada)',
    setorSistema: sys ? sys.setor_name : '-',
    setorHSE: h.setor,
    cotaSistema: sys && sys.monthly_limit != null ? sys.monthly_limit : null,
    cotaHSE: h.cotaProposta,
    contador01_04: s ? s.contador : null,
    achou: !!sys,
  });
}

// ---------- RELATORIO ----------
function fmt(n, w, align = 'right') {
  const s = n == null || n === '' ? '-' : String(n);
  return align === 'right' ? s.padStart(w) : s.padEnd(w);
}

function numero(n) {
  if (n == null || n === '') return '-';
  return Number(n).toLocaleString('pt-BR');
}

console.log('\n===========================================================================================');
console.log('                   COMPARACAO DE COTAS: SISTEMA  x  HSE (Cota Proposta)');
console.log('===========================================================================================');
console.log('Periodo do sistema consultado: 2026-04');
console.log(`Linhas HSE: ${Object.keys(hse).length} | Linhas Simpress: ${Object.keys(simpress).length} | Impressoras ativas no sistema: ${sistema.length}`);
console.log('===========================================================================================\n');

// Ordena por nome do sistema (ou setor HSE se nao encontrada)
linhas.sort((a, b) => {
  const ka = (a.nomeSistema !== '(nao encontrada)' ? a.nomeSistema : a.setorHSE).toLowerCase();
  const kb = (b.nomeSistema !== '(nao encontrada)' ? b.nomeSistema : b.setorHSE).toLowerCase();
  return ka.localeCompare(kb, 'pt-BR');
});

const header =
  fmt('#', 4, 'left') +
  fmt('SERIE', 14, 'left') +
  fmt('IMPRESSORA (sistema)', 30, 'left') +
  fmt('SETOR (sistema)', 22, 'left') +
  fmt('SETOR HSE', 22, 'left') +
  fmt('COTA SIS', 10) +
  fmt('COTA HSE', 10) +
  fmt('DIFF', 10) +
  fmt('CONT 01/04', 12);
console.log(header);
console.log('-'.repeat(header.length));

let ok = 0, divergentes = 0, naoEncontradas = 0, semCota = 0;
let i = 0;
for (const l of linhas) {
  i++;
  if (!l.achou) naoEncontradas++;
  else if (l.cotaSistema == null) semCota++;
  else if (l.cotaSistema === l.cotaHSE) ok++;
  else divergentes++;

  let diff = '-';
  if (l.cotaSistema != null && l.cotaHSE != null) {
    const d = l.cotaSistema - l.cotaHSE;
    diff = (d > 0 ? '+' : '') + d.toLocaleString('pt-BR');
  }

  // Marcador visual
  let tag = ' ';
  if (!l.achou) tag = '?';
  else if (l.cotaSistema == null) tag = 'N';
  else if (l.cotaSistema !== l.cotaHSE) tag = '!';

  console.log(
    fmt(tag + String(i), 4, 'left') +
    fmt(l.serie, 14, 'left') +
    fmt((l.nomeSistema || '').substring(0, 28), 30, 'left') +
    fmt((l.setorSistema || '-').substring(0, 20), 22, 'left') +
    fmt((l.setorHSE || '-').substring(0, 20), 22, 'left') +
    fmt(numero(l.cotaSistema), 10) +
    fmt(numero(l.cotaHSE), 10) +
    fmt(diff, 10) +
    fmt(numero(l.contador01_04), 12)
  );
}

console.log('-'.repeat(header.length));
console.log('\nLegenda: (!) cota divergente | (?) impressora nao encontrada no sistema | (N) sem cota cadastrada no sistema\n');

console.log('====================== RESUMO ======================');
console.log(`Total linhas HSE comparadas:            ${linhas.length}`);
console.log(`  Cotas IGUAIS (sistema = HSE):         ${ok}`);
console.log(`  Cotas DIVERGENTES (sistema != HSE):   ${divergentes}`);
console.log(`  Sem cota no sistema (periodo 2026-04):${semCota}`);
console.log(`  Impressora nao encontrada no sistema: ${naoEncontradas}`);
console.log('====================================================\n');

// Tabela so das divergentes (destaque)
const diffs = linhas.filter(l => l.achou && l.cotaSistema != null && l.cotaSistema !== l.cotaHSE);
if (diffs.length > 0) {
  console.log('============ SOMENTE AS DIVERGENTES ================');
  console.log(fmt('IMPRESSORA', 30, 'left') + fmt('COTA SIS', 10) + fmt('COTA HSE', 10) + fmt('DIFF', 10));
  console.log('-'.repeat(60));
  diffs.sort((a, b) => Math.abs((b.cotaSistema || 0) - (b.cotaHSE || 0)) - Math.abs((a.cotaSistema || 0) - (a.cotaHSE || 0)));
  for (const l of diffs) {
    const d = l.cotaSistema - l.cotaHSE;
    console.log(
      fmt((l.nomeSistema || '').substring(0, 28), 30, 'left') +
      fmt(numero(l.cotaSistema), 10) +
      fmt(numero(l.cotaHSE), 10) +
      fmt((d > 0 ? '+' : '') + d.toLocaleString('pt-BR'), 10)
    );
  }
  console.log('====================================================\n');
}

process.exit(0);
