const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'impressao-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

function login(username, password) {
  const user = db.prepare(
    'SELECT id, username, name, password_hash, role, active FROM users WHERE username = ?'
  ).get(username);

  if (!user) throw Object.assign(new Error('Usuário ou senha inválidos'), { status: 401 });
  if (!user.active) throw Object.assign(new Error('Usuário desativado'), { status: 403 });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    throw Object.assign(new Error('Usuário ou senha inválidos'), { status: 401 });
  }

  const sectors = getUserSectors(user.id);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      sectors,
    },
  };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getUserSectors(userId) {
  return db.prepare(
    'SELECT sector_id FROM user_sectors WHERE user_id = ?'
  ).all(userId).map(r => r.sector_id);
}

function getMe(userId) {
  const user = db.prepare(
    'SELECT id, username, name, role, active, created_at FROM users WHERE id = ?'
  ).get(userId);
  if (!user) return null;
  user.sectors = getUserSectors(userId);
  return user;
}

module.exports = { login, verifyToken, getUserSectors, getMe };
