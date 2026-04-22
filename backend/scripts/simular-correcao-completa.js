/**
 * Simula o fluxo completo de correcao numa base de teste:
 *   1) importa baseline 01/04 a partir do Simpress
 *   2) apaga todas as leituras SNMP (exceto baseline)
 *   3) coleta SNMP com o OID A4 correto
 *   4) recalcula current_usage
 *   5) mostra relatorio final
 *
 * Uso:
 *   node scripts/simular-correcao-completa.js "<simpress.xlsx>"
 */
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../src/config/db');
const snmpService = require('../src/services/snmpService');

const SIMPRESS_PATH = process.argv[2];
if (!SIMPRESS_PATH || !fs.existsSync(SIMPRESS_PATH)) {
  console.error('arg1: simpress.xlsx');
  process.exit(1);
}

const BASELINE_DATE = '2026-04-01 00:00:00';
const PERIOD = '2026-04';

// -------- 1) limpar baselines + leituras atuais --------
console.log('\n==================== SIMULANDO CORRECAO COMPLETA ====================\n');
const delB = db.prepare("DELETE FROM snmp_readings WHERE status = 'baseline'").run();
console.log(`1a) Baselines antigos removidos: ${delB.changes}`);
const delA = db.prepare("DELETE FROM snmp_readings WHERE status != 'baseline' OR status IS NULL").run();
console.log(`1b) Leituras comuns removidas: ${delA.changes}`);

// -------- 2) importar baseline do Simpress --------
const wb = XLSX.readFile(SIMPRESS_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });

const findPrinter = db.prepare("SELECT id, name FROM printers WHERE ip_address = ? AND active = 1");
const findPrinterBySerial = db.prepare("SELECT id, name FROM printers WHERE UPPER(serial_number) = ? AND active = 1");
const insertReading = db.prepare(
  "INSERT INTO snmp_readings (printer_id, page_count, mono_count, color_count, status, created_at) VALUES (?, ?, ?, ?, 'baseline', ?)"
);

let imported = 0, notFound = 0;
db.transaction(() => {
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const serie = String(r[2]).trim().toUpperCase();
    const ip = r[3] ? String(r[3]).trim() : '';
    const pbA4 = Number(r[14]) || 0;
    const colorA4 = Number(r[15]) || 0;
    const pbA3 = Number(r[16]) || 0;
    const colorA3 = Number(r[17]) || 0;
    const total = pbA4 + colorA4 + pbA3 + colorA3;
    const mono = pbA4 + pbA3;
    const color = colorA4 + colorA3;
    if (total <= 0) continue;

    let printer = findPrinterBySerial.get(serie);
    if (!printer && ip) printer = findPrinter.get(ip);
    if (!printer) { notFound++; continue; }

    insertReading.run(printer.id, total, mono, color, BASELINE_DATE);
    imported++;
  }
})();
console.log(`2) Baselines Simpress importados: ${imported} | nao encontrados no sistema: ${notFound}`);

// -------- 3) coletar SNMP com OID novo --------
(async function main() {
  console.log(`\n3) Coletando SNMP ao vivo (OID A4 correto) em todas as impressoras ativas...`);
  const r = await snmpService.collectAll();
  console.log(`   Sucesso: ${r.success} | Falhas: ${r.failed} de ${r.total}`);

  const porSrc = { a4_mono: 0, a4_color: 0, engine: 0 };
  for (const d of r.details) {
    if (d.pageCountSource && porSrc[d.pageCountSource] != null) porSrc[d.pageCountSource]++;
  }
  console.log(`   Fonte: A4_mono=${porSrc.a4_mono}  A4_color=${porSrc.a4_color}  Engine(fallback)=${porSrc.engine}`);

  // -------- 4) relatorio final --------
  const linhas = db.prepare(`
    SELECT p.name, s.name as setor, q.monthly_limit, q.current_usage,
           ROUND((q.current_usage * 100.0) / NULLIF(q.monthly_limit, 0), 1) AS pct
    FROM printers p
    LEFT JOIN sectors s ON p.sector_id = s.id
    JOIN quotas q ON q.printer_id = p.id AND q.period = ?
    WHERE p.active = 1
    ORDER BY pct DESC NULLS LAST
  `).all(PERIOD);

  console.log(`\n4) ${linhas.length} impressoras com cota em ${PERIOD}:\n`);
  function f(n, w, a='right') {
    const s = n == null ? '-' : (typeof n === 'number' ? n.toLocaleString('pt-BR') : String(n));
    return a === 'right' ? s.padStart(w) : s.padEnd(w);
  }
  console.log(f('IMPRESSORA',28,'left')+f('SETOR',22,'left')+f('COTA',10)+f('USO',10)+f('%',8)+'  STATUS');
  console.log('-'.repeat(85));

  let ex=0, at=0, ok=0, sd=0;
  for (const l of linhas) {
    let status, pct = l.pct;
    if (l.current_usage == null) { status='sem dados'; sd++; }
    else if (pct == null) { status='sem cota'; sd++; }
    else if (pct >= 100) { status='EXCEDEU'; ex++; }
    else if (pct >= 80) { status='atencao'; at++; }
    else { status='ok'; ok++; }

    console.log(
      f(l.name.substring(0,26),28,'left') +
      f((l.setor||'-').substring(0,20),22,'left') +
      f(l.monthly_limit,10) +
      f(l.current_usage,10) +
      f(pct==null?'-':(pct.toString().replace('.',',')+'%'),8) +
      '  ' + status
    );
  }
  console.log('-'.repeat(85));
  console.log(`\n==== RESUMO FINAL ====`);
  console.log(`  EXCEDERAM (>=100%): ${ex}`);
  console.log(`  ATENCAO (80-99%):   ${at}`);
  console.log(`  OK (<80%):          ${ok}`);
  console.log(`  Sem dados:          ${sd}`);
  console.log('========================\n');

  process.exit(0);
})();
