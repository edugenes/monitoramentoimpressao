const db = require('../config/db');

function getAll(filters = {}, sectorIds) {
  let query = `
    SELECT r.*, q.period,
           p.name as printer_name,
           s.name as sector_name,
           u.username as operator_username,
           u.name as operator_name
    FROM releases r
    JOIN quotas q ON r.quota_id = q.id
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    LEFT JOIN users u ON r.created_by_user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (sectorIds && sectorIds.length > 0) {
    const placeholders = sectorIds.map(() => '?').join(',');
    query += ` AND q.sector_id IN (${placeholders})`;
    params.push(...sectorIds);
  }

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

const createRelease = db.transaction(({ quota_id, amount, reason, released_by, created_by_user_id }) => {
  const stmt = db.prepare(
    'INSERT INTO releases (quota_id, amount, reason, released_by, created_by_user_id) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    quota_id,
    amount,
    reason || null,
    released_by || null,
    created_by_user_id || null
  );

  return db.prepare(`
    SELECT r.*, u.username as operator_username, u.name as operator_name
    FROM releases r
    LEFT JOIN users u ON r.created_by_user_id = u.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);
});

function create(data) {
  const release = createRelease(data);

  // Apos criar liberacao, reavalia creditos e sincroniza com a impressora.
  try {
    const printerId = db.prepare(`
      SELECT printer_id FROM quotas WHERE id = ?
    `).get(data.quota_id)?.printer_id;
    if (printerId) {
      const printerControl = require('./printerControlService');
      printerControl.syncQuotaToPrinter(printerId, { triggeredBy: `release:${data.created_by_user_id || 'unknown'}` })
        .catch((err) => console.warn(`[printerControl] sync apos liberacao ${printerId}: ${err.message}`));
    }
  } catch (err) {
    console.warn('[printerControl] hook em release falhou:', err.message);
  }

  return release;
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
