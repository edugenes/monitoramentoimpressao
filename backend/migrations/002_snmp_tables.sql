-- Tabela de leituras SNMP (contadores acumulados)
CREATE TABLE IF NOT EXISTS snmp_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  page_count INTEGER NOT NULL,
  color_count INTEGER,
  mono_count INTEGER,
  toner_level INTEGER,
  status TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Historico mensal consolidado por impressora
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  start_count INTEGER NOT NULL,
  end_count INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(printer_id, period)
);

-- Campo de comunidade SNMP na tabela de impressoras
ALTER TABLE printers ADD COLUMN snmp_community TEXT DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_snmp_readings_printer ON snmp_readings(printer_id);
CREATE INDEX IF NOT EXISTS idx_snmp_readings_created ON snmp_readings(created_at);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_period ON monthly_snapshots(period);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_printer ON monthly_snapshots(printer_id);
