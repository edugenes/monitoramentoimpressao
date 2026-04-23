const db = require('../src/config/db');

const args = process.argv.slice(2);
const idFlagIdx = args.indexOf('--id');
const forceFlag = args.includes('--force');
const idArg = idFlagIdx >= 0 ? parseInt(args[idFlagIdx + 1], 10) : null;

function listarUltimas(limit = 20) {
  const rows = db.prepare(`
    SELECT r.id, r.amount, r.reason, r.released_by, r.created_at,
           p.name AS printer, s.name AS sector, q.period
    FROM releases r
    JOIN quotas q  ON r.quota_id = q.id
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s  ON q.sector_id = s.id
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit);

  console.log(`\nUltimas ${rows.length} liberacoes:\n`);
  console.log(' ID  | DATA/HORA           | IMPRESSORA            | SETOR            | PAGS  | QUEM');
  console.log('-----+---------------------+-----------------------+------------------+-------+--------------------');
  for (const r of rows) {
    console.log(
      ` ${String(r.id).padStart(3)} | ${(r.created_at || '').padEnd(19)} | ${(r.printer || '').padEnd(21).slice(0, 21)} | ${(r.sector || '').padEnd(16).slice(0, 16)} | ${String(r.amount).padStart(5)} | ${r.released_by || ''}`
    );
  }
  console.log('\nPara excluir:');
  console.log('  node scripts\\excluir-liberacao.js --id <ID>');
  console.log('');
}

function buscarLiberacao(id) {
  return db.prepare(`
    SELECT r.id, r.amount, r.reason, r.released_by, r.created_at,
           r.quota_id, p.name AS printer, s.name AS sector, q.period,
           q.monthly_limit
    FROM releases r
    JOIN quotas q  ON r.quota_id = q.id
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s  ON q.sector_id = s.id
    WHERE r.id = ?
  `).get(id);
}

function excluir(id) {
  const rel = buscarLiberacao(id);
  if (!rel) {
    console.log(`\n[ERRO] Nao existe liberacao com ID ${id}.\n`);
    listarUltimas();
    process.exit(1);
  }

  console.log('\nLiberacao encontrada:\n');
  console.log(`  ID ............... ${rel.id}`);
  console.log(`  Data/Hora ........ ${rel.created_at}`);
  console.log(`  Impressora ....... ${rel.printer}`);
  console.log(`  Setor ............ ${rel.sector}`);
  console.log(`  Periodo .......... ${rel.period}`);
  console.log(`  Paginas .......... +${rel.amount}`);
  console.log(`  Motivo ........... ${rel.reason || '-'}`);
  console.log(`  Liberado por ..... ${rel.released_by || '-'}`);
  console.log(`  Cota mensal ...... ${rel.monthly_limit}`);

  const totalAntes = db.prepare('SELECT COALESCE(SUM(amount), 0) AS t FROM releases WHERE quota_id = ?').get(rel.quota_id).t;
  console.log(`  Total liberado na cota (antes): ${totalAntes}`);
  console.log(`  Limite efetivo (antes): ${rel.monthly_limit + totalAntes}`);
  console.log(`  Limite efetivo apos exclusao:   ${rel.monthly_limit + totalAntes - rel.amount}`);

  if (!forceFlag) {
    console.log('\n[AVISO] Execute novamente com --force para CONFIRMAR a exclusao:');
    console.log(`  node scripts\\excluir-liberacao.js --id ${id} --force\n`);
    process.exit(0);
  }

  const info = db.prepare('DELETE FROM releases WHERE id = ?').run(id);
  if (info.changes === 1) {
    console.log('\n[OK] Liberacao excluida com sucesso.\n');
  } else {
    console.log('\n[ERRO] Nada foi excluido (liberacao pode ja ter sido removida).\n');
    process.exit(1);
  }
}

if (idArg && !Number.isNaN(idArg)) {
  excluir(idArg);
} else {
  listarUltimas();
}
