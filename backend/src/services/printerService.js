const db = require('../config/db');

function getAll() {
  return db.prepare(`
    SELECT p.*, s.name as sector_name
    FROM printers p
    LEFT JOIN sectors s ON p.sector_id = s.id
    ORDER BY p.name
  `).all();
}

function getById(id) {
  return db.prepare(`
    SELECT p.*, s.name as sector_name
    FROM printers p
    LEFT JOIN sectors s ON p.sector_id = s.id
    WHERE p.id = ?
  `).get(id);
}

function create({ name, model, sector_id, local_description, ip_address, snmp_community }) {
  const stmt = db.prepare(
    'INSERT INTO printers (name, model, sector_id, local_description, ip_address, snmp_community) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, model || null, sector_id || null, local_description || null, ip_address || null, snmp_community || 'public');
  return getById(result.lastInsertRowid);
}

function update(id, { name, model, sector_id, local_description, ip_address, active, snmp_community }) {
  const stmt = db.prepare(
    'UPDATE printers SET name = ?, model = ?, sector_id = ?, local_description = ?, ip_address = ?, active = ?, snmp_community = ? WHERE id = ?'
  );
  stmt.run(name, model || null, sector_id || null, local_description || null, ip_address || null, active ? 1 : 0, snmp_community || 'public', id);
  return getById(id);
}

function remove(id) {
  const printer = getById(id);
  if (!printer) return null;
  db.prepare('DELETE FROM printers WHERE id = ?').run(id);
  return printer;
}

function countActive() {
  const row = db.prepare('SELECT COUNT(*) as total FROM printers WHERE active = 1').get();
  return row.total;
}

module.exports = { getAll, getById, create, update, remove, countActive };
