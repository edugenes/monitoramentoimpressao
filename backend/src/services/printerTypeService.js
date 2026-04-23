const db = require('../config/db');

function getAll() {
  return db.prepare(`
    SELECT pt.id, pt.code, pt.name, pt.monthly_pool, pt.color_only,
           (SELECT COUNT(*) FROM printers p WHERE p.type_id = pt.id AND p.active = 1) AS printer_count
    FROM printer_types pt
    ORDER BY pt.id
  `).all();
}

function getById(id) {
  return db.prepare(`
    SELECT pt.id, pt.code, pt.name, pt.monthly_pool, pt.color_only,
           (SELECT COUNT(*) FROM printers p WHERE p.type_id = pt.id AND p.active = 1) AS printer_count
    FROM printer_types pt
    WHERE pt.id = ?
  `).get(id);
}

function update(id, { monthly_pool, name }) {
  const current = getById(id);
  if (!current) return null;
  const newPool = Number.isFinite(monthly_pool) && monthly_pool >= 0 ? monthly_pool : current.monthly_pool;
  const newName = typeof name === 'string' && name.trim() ? name.trim() : current.name;
  db.prepare('UPDATE printer_types SET monthly_pool = ?, name = ? WHERE id = ?').run(newPool, newName, id);
  return getById(id);
}

/**
 * Retorna, para cada tipo de impressora, o consumo agregado do periodo:
 *  - pool_total      cota mensal contratada (printer_types.monthly_pool)
 *  - printer_count   quantidade de impressoras ativas daquele tipo
 *  - usage_total     soma de quotas.current_usage das impressoras desse tipo no periodo
 *  - releases_total  soma de releases.amount das liberacoes vinculadas a essas quotas
 *  - remaining       pool_total - usage_total - releases_total  (pode ser negativo)
 *  - usage_pct       % ocupado ((usage+releases)/pool) arredondado
 */
function getPoolStatus(period) {
  const types = getAll();

  return types.map((t) => {
    const usageRow = db.prepare(`
      SELECT COALESCE(SUM(q.current_usage), 0) AS usage_total
      FROM quotas q
      JOIN printers p ON p.id = q.printer_id
      WHERE q.period = ? AND p.type_id = ? AND p.active = 1
    `).get(period, t.id);

    const releasesRow = db.prepare(`
      SELECT COALESCE(SUM(r.amount), 0) AS releases_total
      FROM releases r
      JOIN quotas q   ON q.id = r.quota_id
      JOIN printers p ON p.id = q.printer_id
      WHERE q.period = ? AND p.type_id = ? AND p.active = 1
    `).get(period, t.id);

    const usage_total = Number(usageRow.usage_total) || 0;
    const releases_total = Number(releasesRow.releases_total) || 0;
    const consumed = usage_total + releases_total;
    const remaining = t.monthly_pool - consumed;
    const usage_pct = t.monthly_pool > 0 ? Math.round((consumed / t.monthly_pool) * 100) : 0;

    return {
      type_id: t.id,
      code: t.code,
      name: t.name,
      color_only: t.color_only,
      printer_count: t.printer_count,
      pool_total: t.monthly_pool,
      usage_total,
      releases_total,
      remaining,
      usage_pct,
      period,
    };
  });
}

module.exports = { getAll, getById, update, getPoolStatus };
