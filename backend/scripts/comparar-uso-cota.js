/**
 * Relatorio CRU de uso da cota no mes de abril/2026.
 *
 * Conta:
 *   uso_mes = contador_atual_SNMP - contador_01_04_Simpress
 *   % usado = uso_mes / cota_sistema * 100
 *
 * Fontes:
 *   - Simpress xlsx : contador total em 01/04/2026 (baseline)
 *   - Banco         : ultima leitura SNMP (contador atual) e cota (monthly_limit)
 *
 * NAO ALTERA NADA. Apenas mostra o relatorio.
 *
 * Uso:
 *   node scripts/comparar-uso-cota.js "<simpress.xlsx>"
 */
const XLSX = require('xlsx');
const db = require('../src/config/db');

const SIMPRESS_PATH = process.argv[2];
if (!SIMPRESS_PATH) {
  console.error('Uso: node scripts/comparar-uso-cota.js "<simpress.xlsx>"');
  process.exit(1);
}

// ---------- SIMPRESS (baseline em 01/04) ----------
const baselinePorSerie = {};
const baselinePorIp = {};
{
  const wb = XLSX.readFile(SIMPRESS_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const serie = String(r[2]).trim().toUpperCase();
    const ip = r[3] ? String(r[3]).trim() : '';
    const contador =
      (Number(r[14]) || 0) +
      (Number(r[15]) || 0) +
      (Number(r[16]) || 0) +
      (Number(r[17]) || 0);
    baselinePorSerie[serie] = { serie, ip, contador };
    if (ip) baselinePorIp[ip] = { serie, ip, contador };
  }
}

// ---------- SISTEMA: impressoras + cota ----------
const impressoras = db.prepare(`
  SELECT p.id, p.name, p.ip_address, p.serial_number,
         s.name AS setor_name,
         q.monthly_limit,
         q.current_usage AS usage_sistema
  FROM printers p
  LEFT JOIN sectors s ON p.sector_id = s.id
  LEFT JOIN quotas q ON q.printer_id = p.id AND q.period = '2026-04'
  WHERE p.active = 1
  ORDER BY p.name
`).all();

// ultima leitura SNMP
const stmtLatest = db.prepare(`
  SELECT page_count, created_at FROM snmp_readings
  WHERE printer_id = ? AND status != 'baseline'
  ORDER BY created_at DESC LIMIT 1
`);

const linhas = impressoras.map((p) => {
  const latest = stmtLatest.get(p.id);
  const contadorAtual = latest ? latest.page_count : null;
  const ultimaLeitura = latest ? latest.created_at : null;

  // baseline: prioriza serial_number, depois IP
  let base = null;
  if (p.serial_number) {
    base = baselinePorSerie[p.serial_number.trim().toUpperCase()] || null;
  }
  if (!base && p.ip_address) {
    base = baselinePorIp[p.ip_address.trim()] || null;
  }

  const baseline = base ? base.contador : null;
  const usoMes =
    contadorAtual != null && baseline != null ? Math.max(contadorAtual - baseline, 0) : null;
  const cota = p.monthly_limit;
  const pct = cota && cota > 0 && usoMes != null ? (usoMes / cota) * 100 : null;

  return {
    id: p.id,
    nome: p.name,
    setor: p.setor_name,
    ip: p.ip_address,
    serie: p.serial_number,
    baseline,
    contadorAtual,
    usoMes,
    usoSistema: p.usage_sistema,
    cota,
    pct,
    ultimaLeitura,
  };
});

// ---------- IMPRESSAO ----------
function fmt(n, w, align = 'right') {
  const s = n == null || n === '' ? '-' : String(n);
  return align === 'right' ? s.padStart(w) : s.padEnd(w);
}
function num(n) {
  if (n == null || n === '') return '-';
  return Number(n).toLocaleString('pt-BR');
}
function pctStr(p) {
  if (p == null) return '-';
  return p.toFixed(1).replace('.', ',') + '%';
}

console.log('\n============================================================================================================');
console.log('                   USO DA COTA EM ABRIL/2026  (contador_atual - contador_01/04)');
console.log('============================================================================================================\n');

// ordena: primeiro quem ultrapassou (maior % primeiro), depois os demais por %
linhas.sort((a, b) => {
  const pa = a.pct == null ? -1 : a.pct;
  const pb = b.pct == null ? -1 : b.pct;
  return pb - pa;
});

const header =
  fmt('IMPRESSORA', 28, 'left') +
  fmt('SETOR', 22, 'left') +
  fmt('BASELINE 01/04', 16) +
  fmt('ATUAL', 12) +
  fmt('USO MES', 12) +
  fmt('COTA', 10) +
  fmt('%', 8) +
  ' STATUS';
console.log(header);
console.log('-'.repeat(header.length + 15));

let excedeu = 0;
let perto = 0; // 80-100
let tranquilo = 0;
let semDados = 0;

for (const l of linhas) {
  let status = '';
  if (l.usoMes == null) {
    status = 'SEM BASELINE';
    semDados++;
  } else if (l.cota == null) {
    status = 'SEM COTA';
    semDados++;
  } else if (l.pct >= 100) {
    status = `EXCEDEU (+${num(l.usoMes - l.cota)})`;
    excedeu++;
  } else if (l.pct >= 80) {
    status = 'ATENCAO';
    perto++;
  } else {
    status = 'ok';
    tranquilo++;
  }

  console.log(
    fmt((l.nome || '').substring(0, 26), 28, 'left') +
    fmt((l.setor || '-').substring(0, 20), 22, 'left') +
    fmt(num(l.baseline), 16) +
    fmt(num(l.contadorAtual), 12) +
    fmt(num(l.usoMes), 12) +
    fmt(num(l.cota), 10) +
    fmt(pctStr(l.pct), 8) +
    ' ' + status
  );
}

console.log('-'.repeat(header.length + 15));
console.log('\n==================== RESUMO ====================');
console.log(`Total impressoras analisadas: ${linhas.length}`);
console.log(`  EXCEDERAM a cota (>= 100%): ${excedeu}`);
console.log(`  ATENCAO   (80% a 99%):      ${perto}`);
console.log(`  OK        (< 80%):          ${tranquilo}`);
console.log(`  Sem dados (faltou baseline ou cota): ${semDados}`);
console.log('=================================================\n');

// tabela so das que excederam
const passaram = linhas.filter(l => l.pct != null && l.pct >= 100);
if (passaram.length > 0) {
  console.log('============ SO AS QUE EXCEDERAM A COTA ============\n');
  console.log(
    fmt('IMPRESSORA', 28, 'left') +
    fmt('COTA', 10) +
    fmt('USO MES', 12) +
    fmt('EXCESSO', 12) +
    fmt('%', 8)
  );
  console.log('-'.repeat(70));
  passaram.sort((a, b) => (b.usoMes - b.cota) - (a.usoMes - a.cota));
  for (const l of passaram) {
    console.log(
      fmt((l.nome || '').substring(0, 26), 28, 'left') +
      fmt(num(l.cota), 10) +
      fmt(num(l.usoMes), 12) +
      fmt('+' + num(l.usoMes - l.cota), 12) +
      fmt(pctStr(l.pct), 8)
    );
  }
  console.log('=================================================\n');
}

process.exit(0);
