const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'database.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.function('now_local', () => {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Recife' }).replace('T', ' ');
});

console.log(`SQLite conectado: ${DB_PATH}`);

module.exports = db;
