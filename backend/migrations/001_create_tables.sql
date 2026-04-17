CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT,
  location TEXT,
  ip_address TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  responsible TEXT,
  phone TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 0,
  current_usage INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(printer_id, sector_id, period)
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quota_id INTEGER NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT,
  released_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quota_id INTEGER NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
  pages_used INTEGER NOT NULL,
  observation TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_quotas_period ON quotas(period);
CREATE INDEX IF NOT EXISTS idx_quotas_printer ON quotas(printer_id);
CREATE INDEX IF NOT EXISTS idx_quotas_sector ON quotas(sector_id);
CREATE INDEX IF NOT EXISTS idx_releases_quota ON releases(quota_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_quota ON usage_logs(quota_id);
