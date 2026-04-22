/**
 * Importa contadores de páginas do relatório Simpress (março/2026)
 * como baseline do dia 01/04/2026 para cada impressora cadastrada.
 *
 * - Lê o XLSX e extrai IP, contadores físicos (PB/Color A4/A3) e data da leitura.
 * - Aceita apenas leituras datadas entre 25/03/2026 e 02/04/2026
 *   (janela em torno do fechamento de março → baseline confiável de abril).
 * - Insere em snmp_readings com created_at = '2026-04-01 00:00:00'.
 * - Recalcula current_usage das cotas do período vigente.
 * - Faz backup do banco antes.
 *
 * Uso:
 *   node scripts/import-baseline-abril.js "caminho\\para\\relatorio.xlsx"
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../src/config/db');

const XLSX_PATH = process.argv[2];

if (!XLSX_PATH) {
  console.error('Uso: node scripts/import-baseline-abril.js "<caminho-do-xlsx>"');
  process.exit(1);
}

if (!fs.existsSync(XLSX_PATH)) {
  console.error(`Arquivo não encontrado: ${XLSX_PATH}`);
  process.exit(1);
}

// Data alvo: 01/04 00:00 (baseline do mês)
const BASELINE_DATE = '2026-04-01 00:00:00';
const PERIOD = '2026-04';
// Janela de leituras aceitáveis como baseline (25/03 a 02/04 inclusive)
const MIN_DATE = new Date(2026, 2, 25, 0, 0, 0); // mês 0-indexado: 2 = março
const MAX_DATE = new Date(2026, 3, 2, 23, 59, 59); // 3 = abril

// ---------- 1. Backup do banco ----------
const dbPath = path.join(__dirname, '..', 'database.db');
if (fs.existsSync(dbPath)) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, '..', `database.backup.${ts}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[OK] Backup do banco salvo em: ${backupPath}`);
} else {
  console.warn('[AVISO] database.db não encontrado no caminho padrão; prosseguindo sem backup');
}

// ---------- 2. Leitura do XLSX ----------
console.log(`\nLendo ${XLSX_PATH}...`);
const wb = XLSX.readFile(XLSX_PATH);
const sheetName = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
console.log(`Planilha "${sheetName}" com ${rows.length - 1} linhas de dados.`);

// Índices das colunas (baseados no relatório Simpress)
// 0=Contrato, 1=Cliente, 2=Série, 3=IP, 4=Status, 5=Modelo, 6=Apelido, 7=CC,
// 8=ID, 9=CEP, 10=Endereço, 11=Cidade, 12=Estado, 13=Período,
// 14=Físico PB A4, 15=Físico Color A4, 16=Físico PB A3, 17=Físico Color A3,
// 18..21=Lógico PB/Color A4/A3, 22=Data Última Leitura
const COL = {
  ip: 3,
  apelido: 6,
  fisicoPBA4: 14,
  fisicoColorA4: 15,
  fisicoPBA3: 16,
  fisicoColorA3: 17,
  dataUltima: 22,
};

function parseBrDate(str) {
  if (!str) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})$/.exec(String(str).trim());
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

// ---------- 3. Preparação de statements ----------
const findPrinter = db.prepare('SELECT id, name FROM printers WHERE ip_address = ? AND active = 1');
// Limpa TODOS os baselines anteriores (mesmo os com data errada por causa do
// trigger antigo de timezone). Baselines sao identificados pela flag status='baseline'.
const clearAllBaselines = db.prepare("DELETE FROM snmp_readings WHERE status = 'baseline'");
const clearedCount = clearAllBaselines.run().changes;
if (clearedCount > 0) {
  console.log(`[OK] Removidos ${clearedCount} baselines antigos antes da reimportacao.`);
}
const insertReading = db.prepare(
  "INSERT INTO snmp_readings (printer_id, page_count, mono_count, color_count, status, created_at) VALUES (?, ?, ?, ?, 'baseline', ?)"
);

const stats = {
  total: rows.length - 1,
  imported: 0,
  noIp: 0,
  outdated: 0,
  zero: 0,
  notFound: 0,
};
const importedRows = [];
const outdatedRows = [];
const notFoundRows = [];
const zeroRows = [];

// ---------- 4. Importação (transação) ----------
const tx = db.transaction(() => {
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const ip = (r[COL.ip] || '').toString().trim();
    const apelido = r[COL.apelido] || '';
    const pbA4 = Number(r[COL.fisicoPBA4]) || 0;
    const colorA4 = Number(r[COL.fisicoColorA4]) || 0;
    const pbA3 = Number(r[COL.fisicoPBA3]) || 0;
    const colorA3 = Number(r[COL.fisicoColorA3]) || 0;
    const dateStr = r[COL.dataUltima];
    const date = parseBrDate(dateStr);
    const total = pbA4 + colorA4 + pbA3 + colorA3;
    const mono = pbA4 + pbA3;
    const color = colorA4 + colorA3;

    if (!ip) {
      stats.noIp++;
      continue;
    }

    if (!date || date < MIN_DATE || date > MAX_DATE) {
      stats.outdated++;
      outdatedRows.push({ ip, apelido, data: dateStr, contador: total });
      continue;
    }

    if (total <= 0) {
      stats.zero++;
      zeroRows.push({ ip, apelido, data: dateStr });
      continue;
    }

    const printer = findPrinter.get(ip);
    if (!printer) {
      stats.notFound++;
      notFoundRows.push({ ip, apelido, data: dateStr, contador: total });
      continue;
    }

    insertReading.run(printer.id, total, mono, color, BASELINE_DATE);
    stats.imported++;
    importedRows.push({ ip, name: printer.name, contador: total, data: dateStr });
  }
});

tx();

// ---------- 5. Recalcular current_usage das cotas ----------
console.log('\nRecalculando current_usage das cotas do período', PERIOD + '...');

const getLatestReading = db.prepare(
  'SELECT page_count FROM snmp_readings WHERE printer_id = ? ORDER BY created_at DESC LIMIT 1'
);
const getFirstOfMonth = db.prepare(`
  SELECT page_count FROM snmp_readings
  WHERE printer_id = ? AND created_at >= ?
  ORDER BY created_at ASC LIMIT 1
`);
const updateQuota = db.prepare(
  'UPDATE quotas SET current_usage = ? WHERE printer_id = ? AND period = ?'
);

const startOfMonth = `${PERIOD}-01 00:00:00`;
let quotasUpdated = 0;

const recalcTx = db.transaction(() => {
  for (const row of importedRows) {
    const printer = findPrinter.get(row.ip);
    if (!printer) continue;

    const latest = getLatestReading.get(printer.id);
    const first = getFirstOfMonth.get(printer.id, startOfMonth);
    if (!latest || !first) continue;

    const usage = Math.max(latest.page_count - first.page_count, 0);
    const res = updateQuota.run(usage, printer.id, PERIOD);
    if (res.changes > 0) quotasUpdated++;
  }
});

recalcTx();

// ---------- 6. Relatório final ----------
console.log('\n================= RESUMO =================');
console.log(`Linhas no relatório .................. ${stats.total}`);
console.log(`Baseline importado com sucesso ....... ${stats.imported}`);
console.log(`Ignoradas (sem IP) ................... ${stats.noIp}`);
console.log(`Ignoradas (contador zero) ............ ${stats.zero}`);
console.log(`Ignoradas (leitura fora de 25/03-02/04) ${stats.outdated}`);
console.log(`Ignoradas (IP não cadastrado) ........ ${stats.notFound}`);
console.log(`Cotas atualizadas (current_usage) .... ${quotasUpdated}`);
console.log('==========================================');

if (notFoundRows.length) {
  console.log('\n--- IPs no relatório que NÃO estão cadastrados no sistema ---');
  for (const r of notFoundRows) {
    console.log(`  ${r.ip.padEnd(16)} | ${r.apelido || '-'} | ${r.contador} páginas | ${r.data}`);
  }
}

if (outdatedRows.length) {
  console.log('\n--- Leituras descartadas por estarem muito antigas ---');
  for (const r of outdatedRows) {
    console.log(`  ${r.ip.padEnd(16)} | ${r.apelido || '-'} | ${r.data}`);
  }
}

if (importedRows.length) {
  console.log('\n--- Baselines importados ---');
  for (const r of importedRows) {
    console.log(`  ${r.ip.padEnd(16)} | ${r.name} | ${r.contador} páginas @ ${r.data}`);
  }
}

console.log('\nConcluído. A próxima coleta SNMP já usará o novo baseline.\n');
process.exit(0);
