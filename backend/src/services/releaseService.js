const db = require('../config/db');

function getAll(filters = {}) {
  let query = `
    SELECT r.*, q.period, p.name as printer_name, s.name as sector_name
    FROM releases r
    JOIN quotas q ON r.quota_id = q.id
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.period) {
    query += ' AND q.period = ?';
    params.push(filters.period);
  }
  if (filters.printer_id) {
    query += ' AND q.printer_id = ?';
    params.push(filters.printer_id);
  }
  if (filters.sector_id) {
    query += ' AND q.sector_id = ?';
    params.push(filters.sector_id);
  }

  query += ' ORDER BY r.created_at DESC';

  return db.prepare(query).all(...params);
}

const createRelease = db.transaction(({ quota_id, amount, reason, released_by }) => {
  const stmt = db.prepare(
    'INSERT INTO releases (quota_id, amount, reason, released_by) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(quota_id, amount, reason || null, released_by || null);

  return db.prepare('SELECT * FROM releases WHERE id = ?').get(result.lastInsertRowid);
});

function create(data) {
  return createRelease(data);
}

function countByPeriod(period) {
  const row = db.prepare(`
    SELECT COUNT(*) as total FROM releases r
    JOIN quotas q ON r.quota_id = q.id
    WHERE q.period = ?
  `).get(period);
  return row.total;
}

module.exports = { getAll, create, countByPeriod };
