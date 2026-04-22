-- Tabela de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gestor' CHECK(role IN ('admin', 'gestor')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', '-3 hours'))
);

-- Relacao muitos-para-muitos entre usuarios e setores
CREATE TABLE IF NOT EXISTS user_sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  UNIQUE(user_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sectors_user ON user_sectors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sectors_sector ON user_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
