/**
 * Aplica a correcao do OID no banco:
 *   1) Apaga leituras de abril/2026 que NAO sejam o baseline (created_at > 01/04 00:00:00 + 1 min)
 *   2) Forca uma coleta SNMP completa (com o OID A4 correto)
 *   3) Recalcula current_usage das quotas de 2026-04
 *
 * O baseline (Simpress 01/04) e preservado intacto.
 *
 * Uso:
 *   node scripts/aplicar-correcao-oid.js
 */
const db = require('../src/config/db');
const snmpService = require('../src/services/snmpService');

(async function main() {
  console.log('\n================ CORRECAO DE OID ================\n');

  // 1) Apagar leituras de abril (exceto baseline)
  const cut = '2026-04-01 00:05:00'; // baseline tem created_at = '2026-04-01 00:00:00'
  const end = '2026-05-01 00:00:00';
  const antes = db.prepare(
    "SELECT COUNT(*) as c FROM snmp_readings WHERE created_at >= ? AND created_at < ?"
  ).get(cut, end).c;

  console.log(`1) Leituras de abril (apos o baseline) atualmente: ${antes}`);

  const del = db.prepare(
    "DELETE FROM snmp_readings WHERE created_at >= ? AND created_at < ?"
  ).run(cut, end);
  console.log(`   Apagadas: ${del.changes} leituras (baseline de 01/04 preservado)\n`);

  // 2) Forcar coleta SNMP com OID novo
  console.log('2) Forcando nova coleta SNMP com OID A4 correto...');
  const r = await snmpService.collectAll();
  console.log(`   Sucesso: ${r.success} | Falhas: ${r.failed} de ${r.total}\n`);

  // 3) Mostrar quais OIDs foram escolhidos
  const porSource = { a4_mono: 0, a4_color: 0, engine: 0, outro: 0 };
  for (const d of r.details) {
    if (!d.pageCountSource) continue;
    if (porSource[d.pageCountSource] != null) porSource[d.pageCountSource]++;
    else porSource.outro++;
  }
  console.log('3) Fonte do contador por impressora:');
  console.log(`   A4 mono  (16.4.1.1.2.0):         ${porSource.a4_mono}`);
  console.log(`   A4 color (16.1.38.13.26.0):      ${porSource.a4_color}`);
  console.log(`   Engine (fallback):               ${porSource.engine}`);

  // 4) Resumo do uso vs cota
  console.log('\n4) Uso do mes (abril/2026) vs cota (so as que excederam):');
  const linhas = db.prepare(`
    SELECT p.name, q.monthly_limit, q.current_usage,
           ROUND((q.current_usage * 100.0) / NULLIF(q.monthly_limit, 0), 1) AS pct
    FROM printers p
    JOIN quotas q ON q.printer_id = p.id AND q.period = '2026-04'
    WHERE p.active = 1 AND q.current_usage >= q.monthly_limit
    ORDER BY (q.current_usage - q.monthly_limit) DESC
  `).all();

  if (linhas.length === 0) {
    console.log('   Nenhuma impressora excedeu.');
  } else {
    for (const l of linhas) {
      console.log(`   ${l.name.padEnd(30)} uso ${String(l.current_usage).padStart(8)} / cota ${String(l.monthly_limit).padStart(6)}  (${String(l.pct||'').padStart(6)}%)`);
    }
  }
  console.log(`\nTotal impressoras excederam: ${linhas.length}`);
  console.log('\n=================================================\n');
  process.exit(0);
})();
