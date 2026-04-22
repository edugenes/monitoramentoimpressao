-- Corrige os triggers de timezone para NAO sobrescrever datas historicas
-- explicitas (como baselines importados). Eles agora so corrigem o TZ
-- quando o INSERT nao passa um created_at customizado (ou quando o
-- created_at e "agora", gerado pelo DEFAULT da coluna).

DROP TRIGGER IF EXISTS fix_printers_tz;
DROP TRIGGER IF EXISTS fix_sectors_tz;
DROP TRIGGER IF EXISTS fix_quotas_tz;
DROP TRIGGER IF EXISTS fix_releases_tz;
DROP TRIGGER IF EXISTS fix_snmp_readings_tz;
DROP TRIGGER IF EXISTS fix_monthly_snapshots_tz;

-- Heuristica: se NEW.created_at esta dentro de 60 segundos do 'now' UTC,
-- assumimos que foi gerado pelo DEFAULT da coluna (datetime('now','localtime'))
-- e aplicamos o ajuste -3h para America/Recife. Caso contrario (data historica
-- explicita) o trigger nao mexe.

CREATE TRIGGER fix_printers_tz AFTER INSERT ON printers
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE printers SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER fix_sectors_tz AFTER INSERT ON sectors
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE sectors SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER fix_quotas_tz AFTER INSERT ON quotas
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE quotas SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER fix_releases_tz AFTER INSERT ON releases
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE releases SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER fix_snmp_readings_tz AFTER INSERT ON snmp_readings
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE snmp_readings SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER fix_monthly_snapshots_tz AFTER INSERT ON monthly_snapshots
WHEN (strftime('%s','now') - strftime('%s', NEW.created_at)) BETWEEN -2 AND 60
BEGIN
  UPDATE monthly_snapshots SET created_at = datetime('now','-3 hours') WHERE rowid = NEW.rowid;
END;
