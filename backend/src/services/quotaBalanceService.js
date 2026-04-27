/**
 * Servico de Balanceamento de Cotas.
 *
 * Fornece a "foto" da frota em tempo real: quanto esta alocado, usado,
 * disponivel; quem esta estourado, ocioso; e divergencias entre o que o
 * banco diz (monthly_limit) e o que a HP aceita (cota local via EWS).
 *
 * Tudo aqui e LEITURA, exceto rebalance() que muda monthly_limit no banco.
 */
const db = require('../config/db');
const ewsClient = require('./hpEwsCotaLocalClient');
const printerTypeService = require('./printerTypeService');

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Resumo geral (KPIs) da frota para o periodo atual.
 */
function getOverview(period) {
  const p = period || getCurrentPeriod();

  const row = db.prepare(`
    SELECT
      COUNT(DISTINCT q.id) AS quota_count,
      COALESCE(SUM(q.monthly_limit), 0) AS total_alloc,
      COALESCE(SUM(q.current_usage), 0) AS total_used,
      COALESCE(SUM(
        (SELECT COALESCE(SUM(amount), 0) FROM releases r WHERE r.quota_id = q.id)
      ), 0) AS total_releases
    FROM quotas q
    JOIN printers p ON p.id = q.printer_id
    WHERE q.period = ? AND p.active = 1
  `).get(p);

  const overflowed = db.prepare(`
    SELECT COUNT(*) AS c
    FROM quotas q JOIN printers pr ON pr.id = q.printer_id
    WHERE q.period = ? AND pr.active = 1
      AND q.monthly_limit > 0
      AND q.current_usage > (q.monthly_limit + COALESCE(
        (SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0))
  `).get(p).c;

  const idle = db.prepare(`
    SELECT COUNT(*) AS c
    FROM quotas q JOIN printers pr ON pr.id = q.printer_id
    WHERE q.period = ? AND pr.active = 1
      AND q.monthly_limit > 0
      AND CAST(q.current_usage AS REAL) / q.monthly_limit < 0.30
  `).get(p).c;

  const printerCount = db.prepare(`
    SELECT COUNT(*) AS c FROM printers WHERE active = 1
  `).get().c;

  const effective_limit = (row.total_alloc || 0) + (row.total_releases || 0);
  const usage_pct = effective_limit > 0
    ? Math.round((row.total_used / effective_limit) * 1000) / 10
    : 0;

  // Agregacao por tipo de impressora (pool contratado vs uso real).
  // Cada tipo tem custo diferente, portanto cota e analisada separadamente.
  const byType = printerTypeService.getPoolStatus(p);

  return {
    period: p,
    printer_count: printerCount,
    quota_count: row.quota_count,
    total_alloc: row.total_alloc,
    total_releases: row.total_releases,
    effective_limit,
    total_used: row.total_used,
    available: Math.max(0, effective_limit - row.total_used),
    usage_pct,
    overflowed_count: overflowed,
    idle_count: idle,
    by_type: byType,
  };
}

/**
 * Resumo agregado por setor.
 */
function getBySector(period) {
  const p = period || getCurrentPeriod();
  return db.prepare(`
    SELECT
      s.id as sector_id,
      s.name as sector_name,
      COUNT(DISTINCT pr.id) as printer_count,
      COALESCE(SUM(q.monthly_limit), 0) as monthly_limit,
      COALESCE(SUM(q.current_usage), 0) as current_usage,
      COALESCE(SUM(
        (SELECT COALESCE(SUM(amount), 0) FROM releases r WHERE r.quota_id = q.id)
      ), 0) as releases
    FROM sectors s
    LEFT JOIN printers pr ON pr.sector_id = s.id AND pr.active = 1
    LEFT JOIN quotas q ON q.printer_id = pr.id AND q.period = ?
    WHERE s.active = 1
    GROUP BY s.id, s.name
    HAVING printer_count > 0
    ORDER BY current_usage DESC
  `).all(p).map(r => {
    const eff = r.monthly_limit + r.releases;
    return {
      ...r,
      effective_limit: eff,
      usage_pct: eff > 0 ? Math.round((r.current_usage / eff) * 1000) / 10 : 0,
      status: classifyStatus(r.current_usage, eff),
    };
  });
}

function classifyStatus(usage, effLimit) {
  if (effLimit <= 0) return 'unset';
  const pct = (usage / effLimit) * 100;
  if (pct >= 100) return 'overflow';
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  if (pct < 30) return 'idle';
  return 'ok';
}

/**
 * Lista detalhada de impressoras para o periodo, com classificacao de status.
 */
function listPrinters(period, { sectorIds, status, search } = {}) {
  const p = period || getCurrentPeriod();
  let query = `
    SELECT
      pr.id, pr.name, pr.ip_address, pr.model, pr.sector_id,
      pr.quota_sync_enabled, pr.last_quota_sync_credits, pr.last_quota_sync_at, pr.last_quota_sync_error,
      s.name as sector_name,
      pt.code as type_code, pt.name as type_name,
      q.id as quota_id, q.monthly_limit, q.current_usage,
      COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0) as releases
    FROM printers pr
    LEFT JOIN sectors s ON s.id = pr.sector_id
    LEFT JOIN printer_types pt ON pt.id = pr.type_id
    LEFT JOIN quotas q ON q.printer_id = pr.id AND q.period = ?
    WHERE pr.active = 1
  `;
  const params = [p];

  if (sectorIds && sectorIds.length > 0) {
    query += ` AND pr.sector_id IN (${sectorIds.map(() => '?').join(',')})`;
    params.push(...sectorIds);
  }
  if (search) {
    query += ' AND (pr.name LIKE ? OR pr.ip_address LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY s.name, pr.name';

  let rows = db.prepare(query).all(...params).map(r => {
    const eff = (r.monthly_limit || 0) + (r.releases || 0);
    return {
      ...r,
      effective_limit: eff,
      usage_pct: eff > 0 ? Math.round((r.current_usage / eff) * 1000) / 10 : null,
      status: classifyStatus(r.current_usage || 0, eff),
    };
  });

  if (status) rows = rows.filter(r => r.status === status);
  return rows;
}

/**
 * Compara banco vs HP para uma lista de impressoras (ou todas com sync ligado).
 * Retorna apenas as divergentes (limit ou saldo diferentes).
 *
 * Esta funcao consulta a HP em tempo real via EWS - pode demorar.
 */
async function getDivergences({ printerIds, onlySyncEnabled = false, sample = false } = {}) {
  let query = `
    SELECT pr.id, pr.name, pr.ip_address, pr.quota_sync_enabled,
           q.monthly_limit, q.current_usage,
           COALESCE((SELECT SUM(amount) FROM releases WHERE quota_id = q.id), 0) as releases
    FROM printers pr
    LEFT JOIN quotas q ON q.printer_id = pr.id AND q.period = ?
    WHERE pr.active = 1 AND pr.ip_address IS NOT NULL
  `;
  const params = [getCurrentPeriod()];
  if (printerIds && printerIds.length > 0) {
    query += ` AND pr.id IN (${printerIds.map(() => '?').join(',')})`;
    params.push(...printerIds);
  }
  if (onlySyncEnabled) {
    query += ' AND pr.quota_sync_enabled = 1';
  }
  if (sample) query += ' LIMIT 5';
  query += ' ORDER BY pr.name';

  const printers = db.prepare(query).all(...params);
  const results = [];
  for (const p of printers) {
    let hpStatus = null;
    let hpError = null;
    try {
      hpStatus = await ewsClient.getStatus(p.ip_address);
    } catch (err) {
      hpError = err.message;
    }
    const guest = hpStatus?.accounts?.find(u => /^guest$/i.test(u.name) || /convidad/i.test(u.name));
    const others = hpStatus?.accounts?.find(u => /^others?$/i.test(u.name) || /outros?/i.test(u.name));
    const eff = (p.monthly_limit || 0) + (p.releases || 0);
    const expectedCredits = Math.max(0, eff - (p.current_usage || 0));

    const divergent =
      hpError != null ||
      (guest && guest.limit !== expectedCredits) ||
      (others && others.limit !== expectedCredits);

    results.push({
      printer_id: p.id,
      printer_name: p.name,
      ip_address: p.ip_address,
      sync_enabled: !!p.quota_sync_enabled,
      bank: {
        monthly_limit: p.monthly_limit,
        current_usage: p.current_usage,
        releases: p.releases,
        effective_limit: eff,
        expected_credits: expectedCredits,
      },
      hp: hpError ? null : {
        guest_credits: guest?.current ?? null,
        guest_limit: guest?.limit ?? null,
        others_credits: others?.current ?? null,
        others_limit: others?.limit ?? null,
      },
      hp_error: hpError,
      divergent,
    });
  }
  return results;
}

/**
 * Remaneja cota entre 2 impressoras: tira X de fromId e adiciona em toId.
 * NAO altera tetos globais. Falha se from < amount.
 *
 * Cria entrada em audit log via printer_block_events com action='rebalance'
 * (re-aproveitamento da tabela existente).
 */
function rebalance({ fromPrinterId, toPrinterId, amount, reason, userId }) {
  const period = getCurrentPeriod();
  const value = parseInt(amount, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error('amount invalido');
  if (fromPrinterId === toPrinterId) throw new Error('origem e destino iguais');

  // Bloqueia remanejamento entre tipos diferentes (custos diferentes).
  // Mono nao pode receber de Color, MFP nao pode receber de Mono pura, etc.
  const fromP = db.prepare('SELECT id, type_id, name FROM printers WHERE id = ?').get(fromPrinterId);
  const toP = db.prepare('SELECT id, type_id, name FROM printers WHERE id = ?').get(toPrinterId);
  if (!fromP || !toP) throw new Error('impressora nao encontrada');
  if (!fromP.type_id || !toP.type_id) {
    throw new Error('impressora sem tipo definido - nao e possivel remanejar');
  }
  if (fromP.type_id !== toP.type_id) {
    throw new Error(
      `tipos diferentes: ${fromP.name} e ${toP.name} pertencem a pools distintos. ` +
      `Remanejamento so e permitido entre impressoras do mesmo tipo (custo por pagina diferente).`
    );
  }

  const tx = db.transaction(() => {
    const fromQ = db.prepare('SELECT * FROM quotas WHERE printer_id = ? AND period = ?')
      .get(fromPrinterId, period);
    const toQ = db.prepare('SELECT * FROM quotas WHERE printer_id = ? AND period = ?')
      .get(toPrinterId, period);
    if (!fromQ) throw new Error('cota da impressora origem nao encontrada para o periodo');
    if (!toQ) throw new Error('cota da impressora destino nao encontrada para o periodo');

    if (fromQ.monthly_limit < value) {
      throw new Error(`limite insuficiente: origem tem ${fromQ.monthly_limit}, pediu ${value}`);
    }

    db.prepare('UPDATE quotas SET monthly_limit = monthly_limit - ? WHERE id = ?').run(value, fromQ.id);
    db.prepare('UPDATE quotas SET monthly_limit = monthly_limit + ? WHERE id = ?').run(value, toQ.id);

    // Audit
    const insert = db.prepare(`
      INSERT INTO printer_block_events (printer_id, action, credits_before, credits_after, success, triggered_by, error)
      VALUES (?, 'rebalance', ?, ?, 1, ?, ?)
    `);
    insert.run(fromPrinterId, fromQ.monthly_limit, fromQ.monthly_limit - value, `rebalance:user:${userId || 'unknown'}`, reason || `-${value} para imp.${toPrinterId}`);
    insert.run(toPrinterId, toQ.monthly_limit, toQ.monthly_limit + value, `rebalance:user:${userId || 'unknown'}`, reason || `+${value} de imp.${fromPrinterId}`);
  });
  tx();

  return {
    success: true,
    period,
    fromPrinterId,
    toPrinterId,
    amount: value,
  };
}

module.exports = {
  getOverview,
  getBySector,
  listPrinters,
  getDivergences,
  rebalance,
};
