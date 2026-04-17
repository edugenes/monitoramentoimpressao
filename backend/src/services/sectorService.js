const db = require('../config/db');

function getAll() {
  return db.prepare('SELECT * FROM sectors ORDER BY name').all();
}

function getById(id) {
  return db.prepare('SELECT * FROM sectors WHERE id = ?').get(id);
}

function create({ name, responsible }) {
  const stmt = db.prepare(
    'INSERT INTO sectors (name, responsible) VALUES (?, ?)'
  );
  const result = stmt.run(name, responsible || null);
  return getById(result.lastInsertRowid);
}

function update(id, { name, responsible, active }) {
  const stmt = db.prepare(
    'UPDATE sectors SET name = ?, responsible = ?, active = ? WHERE id = ?'
  );
  stmt.run(name, responsible || null, active ? 1 : 0, id);
  return getById(id);
}

function remove(id) {
  const sector = getById(id);
  if (!sector) return null;
  db.prepare('DELETE FROM sectors WHERE id = ?').run(id);
  return sector;
}

function countActive() {
  const row = db.prepare('SELECT COUNT(*) as total FROM sectors WHERE active = 1').get();
  return row.total;
}

module.exports = { getAll, getById, create, update, remove, countActive };
