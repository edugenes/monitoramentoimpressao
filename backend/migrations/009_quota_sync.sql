-- Sincronizacao da Cota Local da impressora HP (EWS).
-- O sistema empurra para a impressora os creditos restantes (limite + liberacoes - uso)
-- nas contas Convidado e Outros. A propria HP entao para de imprimir quando os
-- creditos zeram (Acao=Parar configurada no EWS).
--
-- Colunas adicionadas em printers via seed-admin.js (ALTER TABLE precisa de
-- checagem manual em SQLite):
--   - quota_sync_enabled       BOOLEAN  -- 1 = sincronizar essa impressora
--   - last_quota_sync_at       TEXT     -- timestamp do ultimo sync
--   - last_quota_sync_credits  INTEGER  -- valor enviado no ultimo sync
--   - last_quota_sync_error    TEXT     -- ultima mensagem de erro
--   - manual_unblock_until     TEXT     -- se admin reativou manualmente, congela
--                                          re-bloqueio automatico ate essa data

CREATE TABLE IF NOT EXISTS printer_block_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,           -- sync | reset | message | manual_block | manual_unblock
  credits_before INTEGER,
  credits_after INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  triggered_by TEXT,              -- 'scheduler' | 'release' | 'rollover' | 'admin:<user>'
  created_at TEXT DEFAULT (datetime('now', '-3 hours'))
);

CREATE INDEX IF NOT EXISTS idx_block_events_printer ON printer_block_events(printer_id);
CREATE INDEX IF NOT EXISTS idx_block_events_created ON printer_block_events(created_at);
