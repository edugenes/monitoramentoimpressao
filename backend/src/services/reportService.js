const db = require('../config/db');

function getWeekRange(period, week) {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  if (!week || week === 0) return null;

  const ranges = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: lastDay },
  ];

  const r = ranges[week - 1];
  if (!r) return null;

  const startDate = `${period}-${String(r.start).padStart(2, '0')} 00:00:00`;
  const endDate = `${period}-${String(r.end).padStart(2, '0')} 23:59:59`;
  return { startDate, endDate, label: `${r.start}/${month} a ${r.end}/${month}` };
}

function getUsageFromSnmp(period, week) {
  const range = getWeekRange(period, week);
  if (!range) return null;

  return db.prepare(`
    SELECT
      p.id as printer_id,
      p.name as printer_name,
      p.model,
      p.sector_id,
      s.name as sector_name,
      COALESCE(
        (SELECT sr1.page_count FROM snmp_readings sr1
         WHERE sr1.printer_id = p.id AND sr1.created_at >= ? AND sr1.created_at <= ?
         ORDER BY sr1.created_at DESC LIMIT 1)
        -
        (SELECT sr2.page_count FROM snmp_readings sr2
         WHERE sr2.printer_id = p.id AND sr2.created_at >= ? AND sr2.created_at <= ?
         ORDER BY sr2.created_at ASC LIMIT 1)
      , 0) as week_usage
    FROM printers p
    LEFT JOIN sectors s ON p.sector_id = s.id
    WHERE p.active = 1
      AND p.ip_address IS NOT NULL AND p.ip_address != ''
  `).all(range.startDate, range.endDate, range.startDate, range.endDate);
}

function bySector(period, week) {
  if (week && week > 0) {
    const snmpData = getUsageFromSnmp(period, week);
    if (!snmpData) return [];

    const sectorMap = {};
    for (const row of snmpData) {
      if (!row.sector_id) continue;
      if (!sectorMap[row.sector_id]) {
        sectorMap[row.sector_id] = {
          sector_id: row.sector_id,
          sector_name: row.sector_name,
          total_quotas: 0,
          total_limit: 0,
          total_usage: 0,
        };
      }
      sectorMap[row.sector_id].total_usage += Math.max(row.week_usage, 0);
      sectorMap[row.sector_id].total_quotas++;
    }

    const quotas = db.prepare(`
      SELECT sector_id, SUM(monthly_limit) as total_limit
      FROM quotas WHERE period = ?
      GROUP BY sector_id
    `).all(period);

    for (const q of quotas) {
      if (sectorMap[q.sector_id]) {
        sectorMap[q.sector_id].total_limit = q.total_limit;
      }
    }

    return Object.values(sectorMap)
      .map(s => ({
        ...s,
        total_quotas: String(s.total_quotas),
        total_limit: String(s.total_limit),
        total_usage: String(s.total_usage),
        usage_percentage: s.total_limit > 0
          ? String(Math.round((s.total_usage / s.total_limit) * 1000) / 10)
          : '0',
      }))
      .sort((a, b) => parseInt(b.total_usage) - parseInt(a.total_usage));
  }

  return db.prepare(`
    SELECT 
      s.id as sector_id,
      s.name as sector_name,
      COUNT(q.id) as total_quotas,
      COALESCE(SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)), 0) as total_limit,
      COALESCE(SUM(q.current_usage), 0) as total_usage,
      CASE WHEN SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)) > 0 
        THEN ROUND(CAST(SUM(q.current_usage) AS REAL) / CAST(SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)) AS REAL) * 100, 1)
        ELSE 0 
      END as usage_percentage
    FROM sectors s
    LEFT JOIN quotas q ON s.id = q.sector_id AND q.period = ?
    WHERE s.active = 1
    GROUP BY s.id, s.name
    ORDER BY total_usage DESC
  `).all(period);
}

function byPrinter(period, week) {
  if (week && week > 0) {
    const snmpData = getUsageFromSnmp(period, week);
    if (!snmpData) return [];

    const quotas = db.prepare(`
      SELECT printer_id, monthly_limit FROM quotas WHERE period = ?
    `).all(period);
    const quotaMap = {};
    for (const q of quotas) quotaMap[q.printer_id] = q.monthly_limit;

    return snmpData
      .map(row => {
        const usage = Math.max(row.week_usage, 0);
        const limit = quotaMap[row.printer_id] || 0;
        return {
          printer_id: row.printer_id,
          printer_name: row.printer_name,
          model: row.model,
          total_quotas: limit > 0 ? '1' : '0',
          total_limit: String(limit),
          total_usage: String(usage),
          usage_percentage: limit > 0
            ? String(Math.round((usage / limit) * 1000) / 10)
            : '0',
        };
      })
      .sort((a, b) => parseInt(b.total_usage) - parseInt(a.total_usage));
  }

  return db.prepare(`
    SELECT 
      p.id as printer_id,
      p.name as printer_name,
      p.model,
      COUNT(q.id) as total_quotas,
      COALESCE(SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)), 0) as total_limit,
      COALESCE(SUM(q.current_usage), 0) as total_usage,
      CASE WHEN SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)) > 0 
        THEN ROUND(CAST(SUM(q.current_usage) AS REAL) / CAST(SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)) AS REAL) * 100, 1)
        ELSE 0 
      END as usage_percentage
    FROM printers p
    LEFT JOIN quotas q ON p.id = q.printer_id AND q.period = ?
    WHERE p.active = 1
    GROUP BY p.id, p.name, p.model
    ORDER BY total_usage DESC
  `).all(period);
}

function releasesReport(period, week) {
  if (week && week > 0) {
    const range = getWeekRange(period, week);
    if (!range) return [];

    return db.prepare(`
      SELECT 
        r.id, r.amount, r.reason, r.released_by, r.created_at,
        p.name as printer_name, s.name as sector_name, q.period
      FROM releases r
      JOIN quotas q ON r.quota_id = q.id
      JOIN printers p ON q.printer_id = p.id
      JOIN sectors s ON q.sector_id = s.id
      WHERE q.period = ? AND r.created_at >= ? AND r.created_at <= ?
      ORDER BY r.created_at DESC
    `).all(period, range.startDate, range.endDate);
  }

  return db.prepare(`
    SELECT 
      r.id, r.amount, r.reason, r.released_by, r.created_at,
      p.name as printer_name, s.name as sector_name, q.period
    FROM releases r
    JOIN quotas q ON r.quota_id = q.id
    JOIN printers p ON q.printer_id = p.id
    JOIN sectors s ON q.sector_id = s.id
    WHERE q.period = ?
    ORDER BY r.created_at DESC
  `).all(period);
}

function summary(period) {
  const sectorData = bySector(period);
  const printerData = byPrinter(period);

  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0)), 0) as total_limit,
      COALESCE(SUM(q.current_usage), 0) as total_usage
    FROM quotas q WHERE q.period = ?
  `).get(period);

  const releasesCount = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(r.amount), 0) as total_pages
    FROM releases r
    JOIN quotas q ON r.quota_id = q.id
    WHERE q.period = ?
  `).get(period);

  const printersActive = db.prepare(
    'SELECT COUNT(*) as total FROM printers WHERE active = 1'
  ).get();

  const sectorsActive = db.prepare(
    'SELECT COUNT(*) as total FROM sectors WHERE active = 1'
  ).get();

  const atLimit = db.prepare(`
    SELECT COUNT(*) as total FROM quotas q
    WHERE q.period = ?
      AND q.current_usage >= (q.monthly_limit + COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0))
      AND q.monthly_limit > 0
  `).get(period);

  return {
    period,
    printers_active: printersActive.total,
    sectors_active: sectorsActive.total,
    total_limit: totals.total_limit,
    total_usage: totals.total_usage,
    quotas_at_limit: atLimit.total,
    releases_count: releasesCount.total,
    releases_pages: releasesCount.total_pages,
    by_sector: sectorData,
    by_printer: printerData,
  };
}

module.exports = { bySector, byPrinter, releasesReport, summary, getWeekRange };
