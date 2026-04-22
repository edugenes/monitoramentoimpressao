const bcrypt = require('bcryptjs');
const db = require('../config/db');

function getAll() {
  const users = db.prepare(
    'SELECT id, username, name, role, active, created_at FROM users ORDER BY name'
  ).all();

  for (const user of users) {
    user.sectors = db.prepare(`
      SELECT us.sector_id, s.name as sector_name
      FROM user_sectors us
      JOIN sectors s ON us.sector_id = s.id
      WHERE us.user_id = ?
    `).all(user.id);
  }

  return users;
}

function getById(id) {
  const user = db.prepare(
    'SELECT id, username, name, role, active, created_at FROM users WHERE id = ?'
  ).get(id);
  if (!user) return null;

  user.sectors = db.prepare(`
    SELECT us.sector_id, s.name as sector_name
    FROM user_sectors us
    JOIN sectors s ON us.sector_id = s.id
    WHERE us.user_id = ?
  `).all(id);

  return user;
}

const createUser = db.transaction(({ username, name, password, role, sector_ids }) => {
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, name, hash, role || 'gestor');

  const userId = result.lastInsertRowid;

  if (sector_ids && sector_ids.length > 0) {
    const stmt = db.prepare('INSERT INTO user_sectors (user_id, sector_id) VALUES (?, ?)');
    for (const sectorId of sector_ids) {
      stmt.run(userId, sectorId);
    }
  }

  return userId;
});

function create(data) {
  const userId = createUser(data);
  return getById(userId);
}

const updateUser = db.transaction((id, { username, name, password, role, active, sector_ids }) => {
  const current = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!current) return null;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'UPDATE users SET username = ?, name = ?, password_hash = ?, role = ?, active = ? WHERE id = ?'
    ).run(username, name, hash, role, active ? 1 : 0, id);
  } else {
    db.prepare(
      'UPDATE users SET username = ?, name = ?, role = ?, active = ? WHERE id = ?'
    ).run(username, name, role, active ? 1 : 0, id);
  }

  if (sector_ids !== undefined) {
    db.prepare('DELETE FROM user_sectors WHERE user_id = ?').run(id);
    if (sector_ids && sector_ids.length > 0) {
      const stmt = db.prepare('INSERT INTO user_sectors (user_id, sector_id) VALUES (?, ?)');
      for (const sectorId of sector_ids) {
        stmt.run(id, sectorId);
      }
    }
  }

  return id;
});

function update(id, data) {
  const result = updateUser(id, data);
  if (!result) return null;
  return getById(id);
}

function remove(id) {
  const user = getById(id);
  if (!user) return null;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return user;
}

module.exports = { getAll, getById, create, update, remove };
