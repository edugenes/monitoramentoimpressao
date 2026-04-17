-- Impressora agora pertence a um setor e tem descricao de local
ALTER TABLE printers ADD COLUMN sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL;
ALTER TABLE printers ADD COLUMN local_description TEXT;

CREATE INDEX IF NOT EXISTS idx_printers_sector ON printers(sector_id);
