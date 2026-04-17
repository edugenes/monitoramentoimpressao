const snmp = require('net-snmp');
const db = require('../config/db');

const OIDS = {
  pageCount: '1.3.6.1.2.1.43.10.2.1.4.1.1',
  tonerLevel: '1.3.6.1.2.1.43.11.1.1.9.1.1',
  tonerMaxLevel: '1.3.6.1.2.1.43.11.1.1.8.1.1',
  printerStatus: '1.3.6.1.2.1.25.3.5.1.1.1',
  colorCount: '1.3.6.1.2.1.43.10.2.1.4.1.2',
  monoCount: '1.3.6.1.2.1.43.10.2.1.4.1.3',
};

// OIDs for individual color toner levels (Printer MIB prtMarkerSuppliesLevel)
// Index 1=black(or cyan), 2=cyan(or magenta), 3=magenta(or yellow), 4=yellow(or black)
// HP typically: 1=black, 2=cyan, 3=magenta, 4=yellow
const COLOR_TONER_OIDS = {
  level: [
    '1.3.6.1.2.1.43.11.1.1.9.1.1',  // marker 1
    '1.3.6.1.2.1.43.11.1.1.9.1.2',  // marker 2
    '1.3.6.1.2.1.43.11.1.1.9.1.3',  // marker 3
    '1.3.6.1.2.1.43.11.1.1.9.1.4',  // marker 4
  ],
  maxLevel: [
    '1.3.6.1.2.1.43.11.1.1.8.1.1',
    '1.3.6.1.2.1.43.11.1.1.8.1.2',
    '1.3.6.1.2.1.43.11.1.1.8.1.3',
    '1.3.6.1.2.1.43.11.1.1.8.1.4',
  ],
  colorName: [
    '1.3.6.1.2.1.43.12.1.1.4.1.1',  // marker colorant value 1
    '1.3.6.1.2.1.43.12.1.1.4.1.2',
    '1.3.6.1.2.1.43.12.1.1.4.1.3',
    '1.3.6.1.2.1.43.12.1.1.4.1.4',
  ],
};

const STATUS_MAP = {
  1: 'outro',
  2: 'desconhecido',
  3: 'ociosa',
  4: 'imprimindo',
  5: 'aquecendo',
};

const SNMP_TIMEOUT = 5000;

function snmpGet(session, oids) {
  return new Promise((resolve) => {
    session.get(oids, (error, varbinds) => {
      if (error) {
        resolve({ error: error.message || String(error) });
        return;
      }
      resolve({ varbinds });
    });
  });
}

function parseVarbindValue(vb) {
  if (snmp.isVarbindError(vb)) return null;
  if (vb.type === snmp.ObjectType.NoSuchObject ||
      vb.type === snmp.ObjectType.NoSuchInstance ||
      vb.type === snmp.ObjectType.EndOfMibView) return null;
  const val = Buffer.isBuffer(vb.value) ? parseInt(vb.value.toString(), 10) : vb.value;
  return isNaN(val) ? null : val;
}

function parseVarbindString(vb) {
  if (snmp.isVarbindError(vb)) return null;
  if (vb.type === snmp.ObjectType.NoSuchObject ||
      vb.type === snmp.ObjectType.NoSuchInstance ||
      vb.type === snmp.ObjectType.EndOfMibView) return null;
  if (Buffer.isBuffer(vb.value)) return vb.value.toString().trim().toLowerCase();
  return typeof vb.value === 'string' ? vb.value.trim().toLowerCase() : null;
}

const COLOR_NAME_MAP = {
  'black': 'black', 'preto': 'black', 'bk': 'black', 'k': 'black',
  'cyan': 'cyan', 'ciano': 'cyan', 'c': 'cyan',
  'magenta': 'magenta', 'm': 'magenta',
  'yellow': 'yellow', 'amarelo': 'yellow', 'y': 'yellow',
};

function normalizeColorName(raw) {
  if (!raw) return null;
  return COLOR_NAME_MAP[raw] || null;
}

function calcPercent(level, max) {
  if (level == null) return null;
  if (max != null && max > 0) return Math.round((level / max) * 100);
  if (level >= 0 && level <= 100) return level;
  return null;
}

async function readColorToners(session) {
  const toners = {};
  const allOids = [
    ...COLOR_TONER_OIDS.level,
    ...COLOR_TONER_OIDS.maxLevel,
    ...COLOR_TONER_OIDS.colorName,
  ];

  const res = await snmpGet(session, allOids);
  if (res.error || !res.varbinds) return toners;

  const markers = [];
  for (let i = 0; i < 4; i++) {
    const level = parseVarbindValue(res.varbinds[i]);
    const max = parseVarbindValue(res.varbinds[4 + i]);
    const nameRaw = parseVarbindString(res.varbinds[8 + i]);
    const color = normalizeColorName(nameRaw);
    if (color && level != null) {
      markers.push({ color, percent: calcPercent(level, max) });
    }
  }

  if (markers.length === 0) {
    // Fallback: try individual OIDs one by one
    for (let i = 0; i < 4; i++) {
      const nameRes = await snmpGet(session, [COLOR_TONER_OIDS.colorName[i]]);
      if (nameRes.error || !nameRes.varbinds) continue;
      const nameRaw = parseVarbindString(nameRes.varbinds[0]);
      const color = normalizeColorName(nameRaw);
      if (!color) continue;

      const levelRes = await snmpGet(session, [COLOR_TONER_OIDS.level[i]]);
      const maxRes = await snmpGet(session, [COLOR_TONER_OIDS.maxLevel[i]]);
      const level = levelRes.varbinds ? parseVarbindValue(levelRes.varbinds[0]) : null;
      const max = maxRes.varbinds ? parseVarbindValue(maxRes.varbinds[0]) : null;
      if (level != null) {
        markers.push({ color, percent: calcPercent(level, max) });
      }
    }
  }

  for (const m of markers) {
    toners[m.color] = m.percent;
  }

  return toners;
}

async function readPrinter(ip, community = 'public') {
  const session = snmp.createSession(ip, community, {
    timeout: SNMP_TIMEOUT,
    version: snmp.Version2c,
  });

  const result = { success: false, ip };

  try {
    const essentialOids = [OIDS.pageCount, OIDS.printerStatus];
    const optionalOids = [OIDS.tonerLevel, OIDS.tonerMaxLevel, OIDS.colorCount, OIDS.monoCount];

    const res = await snmpGet(session, [...essentialOids, ...optionalOids]);

    if (res.error) {
      const fallback = await snmpGet(session, essentialOids);
      if (fallback.error) {
        const single = await snmpGet(session, [OIDS.pageCount]);
        if (single.error) {
          result.error = single.error;
          return result;
        }
        const val = parseVarbindValue(single.varbinds[0]);
        if (val != null) { result.pageCount = val; result.success = true; }
        else { result.error = 'Contador de paginas nao disponivel'; }
        return result;
      }
      for (const vb of fallback.varbinds) {
        const val = parseVarbindValue(vb);
        if (val == null) continue;
        if (vb.oid === OIDS.pageCount) result.pageCount = val;
        else if (vb.oid === OIDS.printerStatus) result.status = STATUS_MAP[val] || `status-${val}`;
      }

      for (const oid of optionalOids) {
        const r = await snmpGet(session, [oid]);
        if (r.error || !r.varbinds) continue;
        const val = parseVarbindValue(r.varbinds[0]);
        if (val == null) continue;
        if (oid === OIDS.tonerLevel) result.tonerLevel = val;
        else if (oid === OIDS.tonerMaxLevel) result.tonerMaxLevel = val;
        else if (oid === OIDS.colorCount) result.colorCount = val;
        else if (oid === OIDS.monoCount) result.monoCount = val;
      }
    } else {
      for (const vb of res.varbinds) {
        const val = parseVarbindValue(vb);
        if (val == null) continue;
        if (vb.oid === OIDS.pageCount) result.pageCount = val;
        else if (vb.oid === OIDS.tonerLevel) result.tonerLevel = val;
        else if (vb.oid === OIDS.tonerMaxLevel) result.tonerMaxLevel = val;
        else if (vb.oid === OIDS.printerStatus) result.status = STATUS_MAP[val] || `status-${val}`;
        else if (vb.oid === OIDS.colorCount) result.colorCount = val;
        else if (vb.oid === OIDS.monoCount) result.monoCount = val;
      }
    }

    if (result.pageCount != null) result.success = true;
    else result.error = 'Contador de paginas nao disponivel';

    if (result.tonerLevel != null && result.tonerMaxLevel && result.tonerMaxLevel > 0) {
      result.tonerPercent = Math.round((result.tonerLevel / result.tonerMaxLevel) * 100);
    } else if (result.tonerLevel != null && result.tonerLevel >= 0 && result.tonerLevel <= 100) {
      result.tonerPercent = result.tonerLevel;
    }

    // Try to read individual color toner levels
    try {
      const colorToners = await readColorToners(session);
      if (Object.keys(colorToners).length > 1) {
        result.tonerCyan = colorToners.cyan ?? null;
        result.tonerMagenta = colorToners.magenta ?? null;
        result.tonerYellow = colorToners.yellow ?? null;
        result.tonerBlack = colorToners.black ?? null;
        result.isColor = true;
        // Use black toner as main toner_level for color printers if not already set
        if (result.tonerPercent == null && colorToners.black != null) {
          result.tonerPercent = colorToners.black;
        }
      }
    } catch { /* color toners not available - mono printer */ }
  } catch (err) {
    result.error = err.message || String(err);
  } finally {
    session.close();
  }

  return result;
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function updateQuotaUsage(printerId, currentPageCount) {
  const period = getCurrentPeriod();
  const startOfMonth = `${period}-01 00:00:00`;

  const firstReading = db.prepare(`
    SELECT page_count FROM snmp_readings
    WHERE printer_id = ? AND created_at >= ?
    ORDER BY created_at ASC LIMIT 1
  `).get(printerId, startOfMonth);

  if (!firstReading) return;

  const usage = Math.max(currentPageCount - firstReading.page_count, 0);

  db.prepare(`
    UPDATE quotas SET current_usage = ?
    WHERE printer_id = ? AND period = ?
  `).run(usage, printerId, period);
}

async function collectAll() {
  const printers = db.prepare(
    "SELECT id, ip_address, snmp_community FROM printers WHERE active = 1 AND ip_address IS NOT NULL AND ip_address != ''"
  ).all();

  const results = { success: 0, failed: 0, total: printers.length, details: [] };

  const insertReading = db.prepare(`
    INSERT INTO snmp_readings (printer_id, page_count, color_count, mono_count, toner_level, status, toner_cyan, toner_magenta, toner_yellow, toner_black)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const printer of printers) {
    const data = await readPrinter(printer.ip_address, printer.snmp_community || 'public');

    if (data.success && data.pageCount != null) {
      insertReading.run(
        printer.id,
        data.pageCount,
        data.colorCount ?? null,
        data.monoCount ?? null,
        data.tonerPercent ?? null,
        data.status ?? null,
        data.tonerCyan ?? null,
        data.tonerMagenta ?? null,
        data.tonerYellow ?? null,
        data.tonerBlack ?? null
      );
      updateQuotaUsage(printer.id, data.pageCount);
      results.success++;
      results.details.push({ printer_id: printer.id, ip: printer.ip_address, ...data });
    } else {
      results.failed++;
      results.details.push({ printer_id: printer.id, ip: printer.ip_address, error: data.error || 'Sem contador' });
    }
  }

  console.log(`[SNMP] Coleta: ${results.success} OK, ${results.failed} falhas de ${results.total}`);
  return results;
}

function getReadings(printerId, limit = 100) {
  return db.prepare(
    'SELECT * FROM snmp_readings WHERE printer_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(printerId, limit);
}

function getLatestReadings() {
  return db.prepare(`
    SELECT sr.*, p.name as printer_name, p.ip_address
    FROM snmp_readings sr
    INNER JOIN (
      SELECT printer_id, MAX(id) as max_id
      FROM snmp_readings
      GROUP BY printer_id
    ) latest ON sr.id = latest.max_id
    JOIN printers p ON sr.printer_id = p.id
    ORDER BY p.name
  `).all();
}

function getSnapshots(period) {
  return db.prepare(`
    SELECT ms.*, p.name as printer_name
    FROM monthly_snapshots ms
    JOIN printers p ON ms.printer_id = p.id
    WHERE ms.period = ?
    ORDER BY ms.total_pages DESC
  `).all(period);
}

function closeMonth(period) {
  const printers = db.prepare(
    "SELECT id FROM printers WHERE active = 1 AND ip_address IS NOT NULL AND ip_address != ''"
  ).all();

  const startOfMonth = `${period}-01 00:00:00`;
  const [year, month] = period.split('-').map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const endOfMonth = `${nextMonth}-01 00:00:00`;

  const results = [];

  const upsertSnapshot = db.prepare(`
    INSERT INTO monthly_snapshots (printer_id, period, start_count, end_count, total_pages)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(printer_id, period) DO UPDATE SET
      end_count = excluded.end_count,
      total_pages = excluded.total_pages
  `);

  for (const printer of printers) {
    const first = db.prepare(`
      SELECT page_count FROM snmp_readings
      WHERE printer_id = ? AND created_at >= ? AND created_at < ?
      ORDER BY created_at ASC LIMIT 1
    `).get(printer.id, startOfMonth, endOfMonth);

    const last = db.prepare(`
      SELECT page_count FROM snmp_readings
      WHERE printer_id = ? AND created_at >= ? AND created_at < ?
      ORDER BY created_at DESC LIMIT 1
    `).get(printer.id, startOfMonth, endOfMonth);

    if (first && last) {
      const total = last.page_count - first.page_count;
      upsertSnapshot.run(printer.id, period, first.page_count, last.page_count, Math.max(total, 0));
      results.push({ printer_id: printer.id, start: first.page_count, end: last.page_count, total: Math.max(total, 0) });
    }
  }

  console.log(`[SNMP] Fechamento ${period}: ${results.length} impressoras processadas`);
  return results;
}

function rolloverMonth(fromPeriod, toPeriod) {
  const existingQuotas = db.prepare(`
    SELECT printer_id, sector_id, monthly_limit FROM quotas WHERE period = ?
  `).all(fromPeriod);

  const insertQuota = db.prepare(`
    INSERT OR IGNORE INTO quotas (printer_id, sector_id, monthly_limit, current_usage, period)
    VALUES (?, ?, ?, 0, ?)
  `);

  let created = 0;
  for (const q of existingQuotas) {
    const result = insertQuota.run(q.printer_id, q.sector_id, q.monthly_limit, toPeriod);
    if (result.changes > 0) created++;
  }

  console.log(`[SNMP] Rollover ${fromPeriod} -> ${toPeriod}: ${created} cotas criadas`);
  return { from: fromPeriod, to: toPeriod, created };
}

function getCollectionStatus() {
  const lastReading = db.prepare(
    'SELECT created_at FROM snmp_readings ORDER BY created_at DESC LIMIT 1'
  ).get();

  const totalReadings = db.prepare('SELECT COUNT(*) as total FROM snmp_readings').get();

  const printersWithReadings = db.prepare(
    'SELECT COUNT(DISTINCT printer_id) as total FROM snmp_readings'
  ).get();

  const lowToner = db.prepare(`
    SELECT sr.printer_id, sr.toner_level, p.name as printer_name
    FROM snmp_readings sr
    INNER JOIN (
      SELECT printer_id, MAX(id) as max_id FROM snmp_readings GROUP BY printer_id
    ) latest ON sr.id = latest.max_id
    JOIN printers p ON sr.printer_id = p.id
    WHERE sr.toner_level IS NOT NULL AND sr.toner_level < 20
    ORDER BY sr.toner_level ASC
  `).all();

  return {
    last_collection: lastReading?.created_at || null,
    total_readings: totalReadings.total,
    printers_monitored: printersWithReadings.total,
    low_toner: lowToner,
  };
}

module.exports = {
  readPrinter,
  collectAll,
  updateQuotaUsage,
  getReadings,
  getLatestReadings,
  getSnapshots,
  closeMonth,
  rolloverMonth,
  getCollectionStatus,
};
