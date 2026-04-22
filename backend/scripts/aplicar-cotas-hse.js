const db = require('../src/config/db');

const ajustes = [
  { ip: '192.168.1.232', setor: 'ERGOMETRIA 2', novaCota: 4000 },
];

const period = '2026-04';

const getPrinter = db.prepare('SELECT id, name FROM printers WHERE ip_address = ? AND active = 1');
const getQuota = db.prepare(
  "SELECT id, monthly_limit FROM quotas WHERE printer_id = ? AND period = ? ORDER BY created_at DESC LIMIT 1"
);
const updateQuota = db.prepare("UPDATE quotas SET monthly_limit = ? WHERE id = ?");
const insertQuota = db.prepare(
  "INSERT INTO quotas (printer_id, sector_id, monthly_limit, current_usage, period) VALUES (?, (SELECT sector_id FROM printers WHERE id = ?), ?, 0, ?)"
);

console.log('================================================================');
console.log('  APLICANDO COTA OFICIAL (HSE ATUALIZADO)');
console.log('  Periodo: ' + period);
console.log('================================================================\n');

const tx = db.transaction(() => {
  for (const a of ajustes) {
    const p = getPrinter.get(a.ip);
    if (!p) {
      console.log(`  [PULA] ${a.ip}  impressora nao encontrada`);
      continue;
    }
    const q = getQuota.get(p.id, period);
    if (q) {
      if (q.monthly_limit === a.novaCota) {
        console.log(`  [OK  ] ${a.ip}  ${p.name.padEnd(24)} ja estava ${a.novaCota}`);
      } else {
        updateQuota.run(a.novaCota, q.id);
        console.log(
          `  [UPD ] ${a.ip}  ${p.name.padEnd(24)} ${String(q.monthly_limit).padStart(6)} -> ${String(a.novaCota).padStart(6)}  (${a.setor})`
        );
      }
    } else {
      insertQuota.run(p.id, p.id, a.novaCota, period);
      console.log(`  [NOVA] ${a.ip}  ${p.name.padEnd(24)} cota criada: ${a.novaCota}`);
    }
  }
});
tx();

console.log('\nVerificacao final:\n');
for (const a of ajustes) {
  const p = getPrinter.get(a.ip);
  if (!p) continue;
  const q = getQuota.get(p.id, period);
  console.log(`  ${a.ip}  ${p.name.padEnd(24)} cota = ${q ? q.monthly_limit : '(sem)'}`);
}

console.log('\nConcluido.');
