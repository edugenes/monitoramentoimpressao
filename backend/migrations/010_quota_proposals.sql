-- Migration 010 - Propostas mensais de cota com workflow de aprovacao
-- Usadas pela tela de Balanceamento (/api/quota-balance e /api/quota-proposals).
-- O resetMonth() do printerControlService passa a aplicar a proposta aprovada
-- ao virar o mes; se nao houver, mantem o monthly_limit do periodo anterior.

CREATE TABLE IF NOT EXISTS quota_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,                         -- mes alvo, ex: "2026-05"
  status TEXT NOT NULL DEFAULT 'draft'           -- draft | pending | approved | rejected | applied
    CHECK(status IN ('draft','pending','approved','rejected','applied')),
  generated_at TEXT DEFAULT (datetime('now','-3 hours')),
  generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  rejected_at TEXT,
  applied_at TEXT,                               -- preenchido quando o resetMonth aplicar
  notes TEXT,
  UNIQUE(period)                                 -- uma proposta por periodo (recriavel via DELETE)
);

CREATE INDEX IF NOT EXISTS idx_quota_proposals_status ON quota_proposals(status);
CREATE INDEX IF NOT EXISTS idx_quota_proposals_period ON quota_proposals(period);

CREATE TABLE IF NOT EXISTS quota_proposal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES quota_proposals(id) ON DELETE CASCADE,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  current_limit INTEGER,                         -- monthly_limit atual no momento da geracao
  current_usage INTEGER,                         -- uso ate o momento da geracao
  avg_3m INTEGER,                                -- media de uso ultimos 3 meses (snapshot)
  suggested_limit INTEGER NOT NULL,              -- sugestao do algoritmo
  approved_limit INTEGER,                        -- valor que admin aprovou (NULL = manter sugerido)
  reason TEXT,                                   -- ex: "uso medio 3M=2700, +10% margem"
  created_at TEXT DEFAULT (datetime('now','-3 hours')),
  UNIQUE(proposal_id, printer_id)
);

CREATE INDEX IF NOT EXISTS idx_quota_proposal_items_proposal ON quota_proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_quota_proposal_items_printer ON quota_proposal_items(printer_id);
