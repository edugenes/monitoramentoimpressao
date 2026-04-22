const db = require('../config/db');

// Limiares (poderiam vir de tabela de configuracoes no futuro)
const THRESHOLDS = {
  TONER_CRITICAL: 10,
  TONER_LOW: 25,
  QUOTA_WARNING: 0.9,   // 90% do limite
  OFFLINE_MINUTES: 15,  // 3 coletas consecutivas a 5 min
};

const ALERT_TYPES = {
  TONER_CRITICAL: 'TONER_CRITICAL',
  TONER_LOW: 'TONER_LOW',
  PRINTER_OFFLINE: 'PRINTER_OFFLINE',
  PRINTER_ERROR: 'PRINTER_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  QUOTA_WARNING: 'QUOTA_WARNING',
};

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function findActiveAlert(printerId, type) {
  return db.prepare(`
    SELECT id FROM alerts
    WHERE printer_id = ? AND type = ? AND resolved_at IS NULL
    LIMIT 1
  `).get(printerId, type);
}

function createAlert(printerId, type, severity, message, details = null) {
  if (findActiveAlert(printerId, type)) return null;
  const result = db.prepare(`
    INSERT INTO alerts (printer_id, type, severity, message, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(printerId, type, severity, message, details ? JSON.stringify(details) : null);
  return result.lastInsertRowid;
}

function resolveAlert(printerId, type) {
  db.prepare(`
    UPDATE alerts SET resolved_at = datetime('now','-3 hours')
    WHERE printer_id = ? AND type = ? AND resolved_at IS NULL
  `).run(printerId, type);
}

function minTonerColor(reading) {
  const vals = [
    { color: 'preto', v: reading.toner_black },
    { color: 'ciano', v: reading.toner_cyan },
    { color: 'magenta', v: reading.toner_magenta },
    { color: 'amarelo', v: reading.toner_yellow },
  ].filter(c => c.v != null);
  if (vals.length === 0) {
    return reading.toner_level != null ? { color: '', v: reading.toner_level } : null;
  }
  return vals.reduce((a, b) => (a.v <= b.v ? a : b));
}

function checkTonerAlerts(printer, reading) {
  if (!reading) return;
  const lowest = minTonerColor(reading);
  if (!lowest) return;

  const colorLabel = lowest.color ? ` ${lowest.color}` : '';

  if (lowest.v < THRESHOLDS.TONER_CRITICAL) {
    resolveAlert(printer.id, ALERT_TYPES.TONER_LOW);
    createAlert(
      printer.id,
      ALERT_TYPES.TONER_CRITICAL,
      'critical',
      `Toner${colorLabel} crítico em ${printer.name}: ${lowest.v}%`,
      { color: lowest.color || null, percent: lowest.v }
    );
  } else if (lowest.v < THRESHOLDS.TONER_LOW) {
    resolveAlert(printer.id, ALERT_TYPES.TONER_CRITICAL);
    createAlert(
      printer.id,
      ALERT_TYPES.TONER_LOW,
      'warning',
      `Toner${colorLabel} baixo em ${printer.name}: ${lowest.v}%`,
      { color: lowest.color || null, percent: lowest.v }
    );
  } else {
    resolveAlert(printer.id, ALERT_TYPES.TONER_CRITICAL);
    resolveAlert(printer.id, ALERT_TYPES.TONER_LOW);
  }
}

function checkOfflineAlert(printer) {
  if (!printer.ip_address || !printer.active) return;
  const lastSuccess = printer.last_snmp_success;
  if (!lastSuccess) {
    // Nunca coletou; so cria alerta se a impressora ja existe ha mais do que o intervalo
    return;
  }

  const minutesAgo = Math.floor(
    (Date.now() - new Date(lastSuccess.replace(' ', 'T') + '-03:00').getTime()) / 60000
  );

  if (minutesAgo >= THRESHOLDS.OFFLINE_MINUTES) {
    createAlert(
      printer.id,
      ALERT_TYPES.PRINTER_OFFLINE,
      'critical',
      `Impressora ${printer.name} offline há ${minutesAgo} minutos`,
      { minutes: minutesAgo, ip: printer.ip_address }
    );
  } else {
    resolveAlert(printer.id, ALERT_TYPES.PRINTER_OFFLINE);
  }
}

function checkStatusAlert(printer, reading) {
  if (!reading || !reading.status) return;
  const status = String(reading.status).toLowerCase();
  const errorStates = ['erro', 'error', 'paper jam', 'jam', 'papel', 'atolado', 'offline', 'warning'];
  const hasError = errorStates.some(s => status.includes(s));

  if (hasError) {
    createAlert(
      printer.id,
      ALERT_TYPES.PRINTER_ERROR,
      'warning',
      `Impressora ${printer.name} com status: ${reading.status}`,
      { status: reading.status }
    );
  } else {
    resolveAlert(printer.id, ALERT_TYPES.PRINTER_ERROR);
  }
}

function checkQuotaAlerts(printer) {
  const period = currentPeriod();
  const quota = db.prepare(`
    SELECT id, monthly_limit, current_usage FROM quotas
    WHERE printer_id = ? AND period = ?
  `).get(printer.id, period);

  if (!quota || !quota.monthly_limit || quota.monthly_limit <= 0) return;

  const ratio = quota.current_usage / quota.monthly_limit;

  if (quota.current_usage >= quota.monthly_limit) {
    resolveAlert(printer.id, ALERT_TYPES.QUOTA_WARNING);
    createAlert(
      printer.id,
      ALERT_TYPES.QUOTA_EXCEEDED,
      'critical',
      `Cota estourada em ${printer.name}: ${quota.current_usage} de ${quota.monthly_limit} páginas`,
      { usage: quota.current_usage, limit: quota.monthly_limit }
    );
  } else if (ratio >= THRESHOLDS.QUOTA_WARNING) {
    resolveAlert(printer.id, ALERT_TYPES.QUOTA_EXCEEDED);
    createAlert(
      printer.id,
      ALERT_TYPES.QUOTA_WARNING,
      'warning',
      `Cota próxima do limite em ${printer.name}: ${Math.round(ratio * 100)}% (${quota.current_usage}/${quota.monthly_limit})`,
      { usage: quota.current_usage, limit: quota.monthly_limit, ratio }
    );
  } else {
    resolveAlert(printer.id, ALERT_TYPES.QUOTA_EXCEEDED);
    resolveAlert(printer.id, ALERT_TYPES.QUOTA_WARNING);
  }
}

function generateAlerts() {
  const printers = db.prepare(`
    SELECT p.id, p.name, p.ip_address, p.active, p.last_snmp_success
    FROM printers p
    WHERE p.active = 1
  `).all();

  const latestReadingStmt = db.prepare(`
    SELECT * FROM snmp_readings
    WHERE printer_id = ?
    ORDER BY id DESC LIMIT 1
  `);

  let created = 0;
  let resolved = 0;

  for (const printer of printers) {
    const reading = latestReadingStmt.get(printer.id);
    const beforeUnack = db.prepare(
      'SELECT COUNT(*) as total FROM alerts WHERE printer_id = ? AND resolved_at IS NULL'
    ).get(printer.id).total;

    checkTonerAlerts(printer, reading);
    checkStatusAlert(printer, reading);
    checkOfflineAlert(printer);
    checkQuotaAlerts(printer);

    const afterUnack = db.prepare(
      'SELECT COUNT(*) as total FROM alerts WHERE printer_id = ? AND resolved_at IS NULL'
    ).get(printer.id).total;

    if (afterUnack > beforeUnack) created += afterUnack - beforeUnack;
    if (afterUnack < beforeUnack) resolved += beforeUnack - afterUnack;
  }

  purgeOld(90);

  return { created, resolved };
}

function sectorFilter(sectorIds) {
  if (!sectorIds || sectorIds.length === 0) return { clause: '', params: [] };
  const placeholders = sectorIds.map(() => '?').join(',');
  return {
    clause: ` AND p.sector_id IN (${placeholders})`,
    params: sectorIds,
  };
}

function getAll({ sectorIds, onlyUnacknowledged = false, limit = 200 } = {}) {
  const filter = sectorFilter(sectorIds);
  const ackClause = onlyUnacknowledged ? ' AND a.acknowledged = 0 AND a.resolved_at IS NULL' : '';
  return db.prepare(`
    SELECT a.*, p.name as printer_name, p.sector_id, s.name as sector_name,
           u.name as acknowledged_by_name
    FROM alerts a
    LEFT JOIN printers p ON a.printer_id = p.id
    LEFT JOIN sectors s ON p.sector_id = s.id
    LEFT JOIN users u ON a.acknowledged_by = u.id
    WHERE 1=1 ${ackClause} ${filter.clause}
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(...filter.params, limit);
}

function getUnacknowledgedCount(sectorIds) {
  const filter = sectorFilter(sectorIds);
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN a.severity = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN a.severity = 'warning'  THEN 1 ELSE 0 END) as warning,
      COUNT(*) as total
    FROM alerts a
    LEFT JOIN printers p ON a.printer_id = p.id
    WHERE a.acknowledged = 0 AND a.resolved_at IS NULL ${filter.clause}
  `).get(...filter.params);
  return {
    total: row?.total || 0,
    critical: row?.critical || 0,
    warning: row?.warning || 0,
  };
}

function acknowledge(id, userId) {
  const result = db.prepare(`
    UPDATE alerts
    SET acknowledged = 1,
        acknowledged_by = ?,
        acknowledged_at = datetime('now','-3 hours')
    WHERE id = ? AND acknowledged = 0
  `).run(userId, id);
  return result.changes > 0;
}

function acknowledgeAll(userId, sectorIds) {
  if (sectorIds && sectorIds.length > 0) {
    const placeholders = sectorIds.map(() => '?').join(',');
    return db.prepare(`
      UPDATE alerts
      SET acknowledged = 1,
          acknowledged_by = ?,
          acknowledged_at = datetime('now','-3 hours')
      WHERE acknowledged = 0
        AND printer_id IN (SELECT id FROM printers WHERE sector_id IN (${placeholders}))
    `).run(userId, ...sectorIds).changes;
  }
  return db.prepare(`
    UPDATE alerts
    SET acknowledged = 1,
        acknowledged_by = ?,
        acknowledged_at = datetime('now','-3 hours')
    WHERE acknowledged = 0
  `).run(userId).changes;
}

function purgeOld(days = 90) {
  db.prepare(`
    DELETE FROM alerts
    WHERE created_at < datetime('now','-3 hours', '-' || ? || ' days')
  `).run(days);
}

module.exports = {
  generateAlerts,
  getAll,
  getUnacknowledgedCount,
  acknowledge,
  acknowledgeAll,
  purgeOld,
  ALERT_TYPES,
  THRESHOLDS,
};
