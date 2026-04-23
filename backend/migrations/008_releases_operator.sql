-- Adiciona rastreamento do operador que registrou a liberacao no sistema.
-- Diferente de `released_by` (nome escolhido em dropdown indicando quem AUTORIZOU),
-- `created_by_user_id` guarda o usuario logado que efetivamente OPEROU o sistema
-- (util para auditoria).

ALTER TABLE releases ADD COLUMN created_by_user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_releases_created_by ON releases(created_by_user_id);
