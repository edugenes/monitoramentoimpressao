const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function runMigration(fileName) {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', fileName),
    'utf-8'
  );
  db.exec(sql);
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

// Migration 004 - auth tables
try {
  runMigration('004_auth_tables.sql');
  console.log('Migration 004_auth_tables OK.');
} catch (err) {
  console.warn('Migration 004_auth_tables:', err.message);
}

// Migration 005 - alerts (idempotente, pois ALTER TABLE precisa de checagem manual)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id INTEGER REFERENCES printers(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now','-3 hours')),
      resolved_at TEXT,
      acknowledged INTEGER DEFAULT 0,
      acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      acknowledged_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(printer_id, type, resolved_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_unack ON alerts(acknowledged, resolved_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_printer ON alerts(printer_id);
  `);

  if (!hasColumn('printers', 'last_snmp_success')) {
    db.exec(`ALTER TABLE printers ADD COLUMN last_snmp_success TEXT`);
  }
  console.log('Migration 005_alerts_tables OK.');
} catch (err) {
  console.warn('Migration 005_alerts_tables:', err.message);
}

// Migration 006 - corrige triggers de timezone para preservar datas historicas
try {
  runMigration('006_fix_tz_triggers.sql');
  console.log('Migration 006_fix_tz_triggers OK.');
} catch (err) {
  console.warn('Migration 006_fix_tz_triggers:', err.message);
}

// Coluna serial_number em printers (para cruzar com relatorios Simpress/HSE)
try {
  if (!hasColumn('printers', 'serial_number')) {
    db.exec(`ALTER TABLE printers ADD COLUMN serial_number TEXT`);
    console.log('Coluna serial_number adicionada em printers.');
  }
} catch (err) {
  console.warn('Erro ao adicionar serial_number:', err.message);
}

// Migration 007 - printer_types e cotas gerais por tipo
try {
  runMigration('007_printer_types.sql');
  if (!hasColumn('printers', 'type_id')) {
    db.exec(`ALTER TABLE printers ADD COLUMN type_id INTEGER REFERENCES printer_types(id)`);
    console.log('Coluna type_id adicionada em printers.');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_printers_type ON printers(type_id)`);
  console.log('Migration 007_printer_types OK.');
} catch (err) {
  console.warn('Migration 007_printer_types:', err.message);
}

// Migration 008 - auditoria do operador que registrou a liberacao
try {
  if (!hasColumn('releases', 'created_by_user_id')) {
    db.exec(`ALTER TABLE releases ADD COLUMN created_by_user_id INTEGER REFERENCES users(id)`);
    console.log('Coluna created_by_user_id adicionada em releases.');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_releases_created_by ON releases(created_by_user_id)`);
  console.log('Migration 008_releases_operator OK.');
} catch (err) {
  console.warn('Migration 008_releases_operator:', err.message);
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run('admin', 'Administrador', hash, 'admin');
  console.log('Usuario admin criado (senha: admin123)');
} else {
  console.log('Usuario admin ja existe.');
}

db.close();

try {
  const { run: classificarPorTipo } = require('./classificar-impressoras-por-tipo');
  classificarPorTipo();
} catch (err) {
  console.warn('Classificacao de impressoras por tipo falhou:', err.message);
}

console.log('Seed concluido.');
