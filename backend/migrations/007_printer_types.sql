-- Tipos de impressora e cotas gerais (pool contratado mensal por tipo).
-- Cada impressora pertence a UM tipo; o pool total por tipo e a soma
-- contratada com a Simpress.

CREATE TABLE IF NOT EXISTS printer_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_pool INTEGER NOT NULL DEFAULT 0,
  color_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO printer_types (code, name, monthly_pool, color_only) VALUES
  ('MONOCROMATICA',        'Impressora Monocromatica',        135000, 0),
  ('MULTIFUNCIONAL_MONO',  'Impressora Multifuncional Mono',  105500, 0),
  ('MULTIFUNCIONAL_COLOR', 'Impressora e Multifuncional Color', 5999, 1);

-- Nota: a coluna type_id em printers e adicionada via ALTER TABLE no
-- seed-admin.js (idempotente), ja que ALTER TABLE IF NOT EXISTS nao
-- existe em SQLite.
