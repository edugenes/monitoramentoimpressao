const db = require('../config/db');

function getAll(filters = {}) {
  let query = `
    SELECT q.*, p.name as printer_name, s.name as sector_name,
      COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0) as total_released
    FROM quotas q
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.printer_id) {
    query += ' AND q.printer_id = ?';
    params.push(filters.printer_id);
  }
  if (filters.sector_id) {
    query += ' AND q.sector_id = ?';
    params.push(filters.sector_id);
  }
  if (filters.period) {
    query += ' AND q.period = ?';
    params.push(filters.period);
  }

  query += ' ORDER BY q.period DESC, p.name, s.name';

  return db.prepare(query).all(...params);
}

function getById(id) {
  return db.prepare(`
    SELECT q.*, p.name as printer_name, s.name as sector_name
    FROM quotas q
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    WHERE q.id = ?
  `).get(id);
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function create({ printer_id, monthly_limit }) {
  const printer = db.prepare('SELECT sector_id FROM printers WHERE id = ?').get(printer_id);
  if (!printer) throw new Error('Impressora não encontrada');
  if (!printer.sector_id) throw new Error('Impressora não está vinculada a nenhum setor');

  const period = getCurrentPeriod();
  const stmt = db.prepare(
    'INSERT INTO quotas (printer_id, sector_id, monthly_limit, period) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(printer_id, printer.sector_id, monthly_limit, period);
  return getById(result.lastInsertRowid);
}

function update(id, { monthly_limit }) {
  db.prepare('UPDATE quotas SET monthly_limit = ? WHERE id = ?').run(monthly_limit, id);
  return getById(id);
}

function getStatus(id) {
  const q = db.prepare(`
    SELECT q.*, p.name as printer_name, s.name as sector_name
    FROM quotas q
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    WHERE q.id = ?
  `).get(id);

  if (!q) return null;

  const rel = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total_released FROM releases WHERE quota_id = ?'
  ).get(id);

  const totalReleased = rel.total_released;
  const effectiveLimit = q.monthly_limit + totalReleased;
  const percentage = effectiveLimit > 0
    ? Math.round((q.current_usage / effectiveLimit) * 100)
    : 0;

  return {
    ...q,
    total_released: totalReleased,
    effective_limit: effectiveLimit,
    usage_percentage: percentage,
  };
}

function incrementUsage(id, pages) {
  db.prepare('UPDATE quotas SET current_usage = current_usage + ? WHERE id = ?').run(pages, id);
  return getById(id);
}

function countAtLimit(period) {
  const row = db.prepare(`
    SELECT COUNT(*) as total FROM quotas q
    WHERE q.period = ?
      AND q.current_usage >= (q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0))
      AND q.monthly_limit > 0
  `).get(period);
  return row.total;
}

module.exports = { getAll, getById, create, update, getStatus, incrementUsage, countAtLimit };
