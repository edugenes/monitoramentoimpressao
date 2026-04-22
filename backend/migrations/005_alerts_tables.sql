-- Sistema de alertas

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

-- Adiciona rastreamento de última coleta SNMP bem-sucedida por impressora
-- para detectar quando a impressora fica offline.
ALTER TABLE printers ADD COLUMN last_snmp_success TEXT;
