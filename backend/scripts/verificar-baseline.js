/**
 * Mostra como ficaram as cotas apos o import de baseline.
 * Compara: contador atual (latest) vs baseline importado vs current_usage salvo.
 */
const db = require('../src/config/db');

const PERIOD = '2026-04';

const rows = db.prepare(`
  SELECT
    p.id as printer_id,
    p.name as printer_name,
    p.ip_address,
    q.monthly_limit,
    q.current_usage,
    (SELECT page_count FROM snmp_readings
      WHERE printer_id = p.id AND created_at >= ?
      ORDER BY created_at ASC LIMIT 1) as baseline,
    (SELECT created_at FROM snmp_readings
      WHERE printer_id = p.id AND created_at >= ?
      ORDER BY created_at ASC LIMIT 1) as baseline_date,
    (SELECT page_count FROM snmp_readings
      WHERE printer_id = p.id
      ORDER BY created_at DESC LIMIT 1) as latest,
    (SELECT created_at FROM snmp_readings
      WHERE printer_id = p.id
      ORDER BY created_at DESC LIMIT 1) as latest_date,
    (SELECT COUNT(*) FROM snmp_readings
      WHERE printer_id = p.id AND created_at >= ?) as readings_count
  FROM printers p
  LEFT JOIN quotas q ON q.printer_id = p.id AND q.period = ?
  WHERE p.active = 1
  ORDER BY p.name
`).all(`${PERIOD}-01 00:00:00`, `${PERIOD}-01 00:00:00`, `${PERIOD}-01 00:00:00`, PERIOD);

console.log('\n======================= DIAGNOSTICO DO BASELINE =======================');
console.log(`Periodo: ${PERIOD}\n`);

console.log(
  'IMPRESSORA'.padEnd(30) +
    'IP'.padEnd(18) +
    'BASELINE'.padEnd(10) +
    'ATUAL'.padEnd(10) +
    'USO_CALC'.padEnd(10) +
    'USO_SALVO'.padEnd(10) +
    'LEITURAS'
);
console.log('-'.repeat(100));

let totalSemBaseline = 0;
let totalOk = 0;
let totalDivergente = 0;

for (const r of rows) {
  const name = (r.printer_name || '-').substring(0, 28).padEnd(30);
  const ip = (r.ip_address || '-').padEnd(18);
  const baseline = r.baseline != null ? String(r.baseline).padEnd(10) : 'SEM'.padEnd(10);
  const latest = r.latest != null ? String(r.latest).padEnd(10) : '-'.padEnd(10);
  const calc = r.baseline != null && r.latest != null
    ? String(Math.max(r.latest - r.baseline, 0)).padEnd(10)
    : '-'.padEnd(10);
  const salvo = r.current_usage != null ? String(r.current_usage).padEnd(10) : '-'.padEnd(10);
  const n = r.readings_count || 0;

  if (r.baseline == null) totalSemBaseline++;
  else if (r.current_usage == null) totalOk++;
  else {
    const expected = Math.max((r.latest || 0) - r.baseline, 0);
    if (expected === r.current_usage) totalOk++;
    else totalDivergente++;
  }

  console.log(`${name}${ip}${baseline}${latest}${calc}${salvo}${n}`);
}

console.log('-'.repeat(100));
console.log(`Total impressoras: ${rows.length}`);
console.log(`  OK (uso_salvo = uso_calc): ${totalOk}`);
console.log(`  Sem baseline (precisa de import ou coleta): ${totalSemBaseline}`);
console.log(`  Divergente (precisa recalcular): ${totalDivergente}`);
console.log('=======================================================================\n');

process.exit(0);
