/**
 * Servico de Propostas Mensais de Cota.
 *
 * Fluxo:
 *   1. generateProposal('2026-05'): gera proposta para o proximo mes com base
 *      no uso medio dos ultimos 3 meses (margem de seguranca de 10%).
 *   2. Admin acessa /balanceamento, edita os approved_limit individualmente
 *      ou em massa, ate o resultado refletir a estrategia da empresa.
 *   3. approveProposal(id, userId): trava a proposta. Status -> approved.
 *   4. resetMonth() do printerControlService chama applyApprovedProposal()
 *      no dia 1 e usa os approved_limit para criar as novas linhas em quotas.
 *
 * Algoritmo de sugestao (suggestLimit):
 *   - Pega o uso de cada um dos ultimos 3 meses fechados.
 *   - Calcula a media (apenas dos meses com snapshot real).
 *   - Aplica margem de 10% para cima (folga).
 *   - Arredonda para multiplo de 50 mais proximo (visual amigavel).
 *   - Limites:
 *       * Se nao ha historico (impressora nova), usa o monthly_limit atual.
 *       * Se uso medio = 0 (impressora ociosa por 3 meses), sugere
 *         max(100, monthly_limit_atual * 0.5) para evitar bloquear sem
 *         historico mas tambem nao manter cota ociosa exagerada.
 */
const db = require('../config/db');

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getNextPeriod() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousPeriods(count) {
  const now = new Date();
  const out = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function roundTo50(n) {
  return Math.round(n / 50) * 50;
}

/**
 * Calcula sugestao de limite para uma impressora no proximo periodo.
 * Retorna { suggested, avg3m, reason }.
 */
function suggestLimit(printerId, currentLimit, currentUsage) {
  // Coleta uso dos ultimos 3 meses fechados (via monthly_snapshots)
  const last3 = getPreviousPeriods(3);
  const placeholders = last3.map(() => '?').join(',');
  const snapshots = db.prepare(`
    SELECT period, total_pages
    FROM monthly_snapshots
    WHERE printer_id = ? AND period IN (${placeholders})
  `).all(printerId, ...last3);

  const validUsages = snapshots
    .map(s => Number(s.total_pages))
    .filter(n => Number.isFinite(n) && n >= 0);

  // Inclui o mes atual como referencia tambem (uso parcial)
  const includeCurrent = Number.isFinite(currentUsage) && currentUsage > 0;
  const referenceUsages = includeCurrent ? [...validUsages, currentUsage] : validUsages;

  let avg3m = 0;
  let reason;
  let suggested;

  if (referenceUsages.length === 0) {
    suggested = currentLimit || 0;
    reason = 'Sem historico - mantem limite atual';
  } else {
    avg3m = Math.round(referenceUsages.reduce((a, b) => a + b, 0) / referenceUsages.length);
    if (avg3m === 0) {
      suggested = Math.max(100, Math.floor((currentLimit || 0) * 0.5));
      reason = 'Uso medio = 0 (ociosa) - sugere 50% do limite atual';
    } else {
      const withMargin = Math.ceil(avg3m * 1.10);
      suggested = Math.max(50, roundTo50(withMargin));
      reason = `Media ${avg3m}p (${referenceUsages.length}m) +10% margem`;
    }
  }

  return { suggested, avg3m, reason };
}

/**
 * Gera (ou regenera) a proposta para um periodo. Se ja existe, deleta os
 * itens antigos e recria. Mantem a mesma proposal_id para preservar historico
 * de aprovacao se ja foi aprovada (caso queira regerar antes de aplicar).
 *
 * Retorna a proposta com seus itens.
 */
function generateProposal(period, userId) {
  const tx = db.transaction(() => {
    let proposal = db.prepare('SELECT * FROM quota_proposals WHERE period = ?').get(period);

    if (!proposal) {
      const r = db.prepare(`
        INSERT INTO quota_proposals (period, status, generated_by_user_id)
        VALUES (?, 'draft', ?)
      `).run(period, userId || null);
      proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(r.lastInsertRowid);
    } else {
      // So permite regenerar se ainda nao aplicou
      if (proposal.status === 'applied') {
        throw new Error('Proposta ja aplicada - nao pode ser regenerada');
      }
      db.prepare('DELETE FROM quota_proposal_items WHERE proposal_id = ?').run(proposal.id);
      db.prepare(`
        UPDATE quota_proposals
        SET status = 'draft', generated_at = datetime('now','-3 hours'),
            generated_by_user_id = ?, approved_by_user_id = NULL,
            approved_at = NULL, rejected_at = NULL
        WHERE id = ?
      `).run(userId || null, proposal.id);
    }

    // Pega impressoras ativas com setor e cota do periodo atual
    const cur = getCurrentPeriod();
    const printers = db.prepare(`
      SELECT p.id, p.name, p.sector_id,
             q.monthly_limit, q.current_usage
      FROM printers p
      LEFT JOIN quotas q ON q.printer_id = p.id AND q.period = ?
      WHERE p.active = 1
      ORDER BY p.id
    `).all(cur);

    const insert = db.prepare(`
      INSERT INTO quota_proposal_items (
        proposal_id, printer_id, current_limit, current_usage,
        avg_3m, suggested_limit, approved_limit, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of printers) {
      const currentLimit = p.monthly_limit ?? 0;
      const currentUsage = p.current_usage ?? 0;
      const { suggested, avg3m, reason } = suggestLimit(p.id, currentLimit, currentUsage);
      insert.run(proposal.id, p.id, currentLimit, currentUsage, avg3m, suggested, null, reason);
    }

    return proposal.id;
  });

  const id = tx();
  return getProposal(id);
}

function getProposal(id) {
  const proposal = db.prepare(`
    SELECT qp.*,
           gu.name as generated_by_name,
           au.name as approved_by_name
    FROM quota_proposals qp
    LEFT JOIN users gu ON qp.generated_by_user_id = gu.id
    LEFT JOIN users au ON qp.approved_by_user_id = au.id
    WHERE qp.id = ?
  `).get(id);
  if (!proposal) return null;
  proposal.items = getProposalItems(id);
  proposal.totals = sumTotals(proposal.items);
  return proposal;
}

function getProposalByPeriod(period) {
  const p = db.prepare('SELECT id FROM quota_proposals WHERE period = ?').get(period);
  return p ? getProposal(p.id) : null;
}

function getProposalItems(proposalId) {
  return db.prepare(`
    SELECT qpi.*,
           p.name as printer_name, p.ip_address, p.model, p.type_id,
           s.name as sector_name,
           pt.code as type_code, pt.name as type_name, pt.monthly_pool as type_pool
    FROM quota_proposal_items qpi
    JOIN printers p ON qpi.printer_id = p.id
    LEFT JOIN sectors s ON p.sector_id = s.id
    LEFT JOIN printer_types pt ON p.type_id = pt.id
    WHERE qpi.proposal_id = ?
    ORDER BY pt.code, s.name, p.name
  `).all(proposalId);
}

function sumTotals(items) {
  let totalCurrent = 0;
  let totalSuggested = 0;
  let totalApproved = 0;
  // Agrupa por tipo de impressora (custos diferentes => pools diferentes)
  const byType = {};
  for (const it of items) {
    const final = it.approved_limit ?? it.suggested_limit ?? 0;
    totalCurrent += it.current_limit || 0;
    totalSuggested += it.suggested_limit || 0;
    totalApproved += final;

    const key = it.type_code || 'SEM_TIPO';
    if (!byType[key]) {
      byType[key] = {
        type_code: key,
        type_name: it.type_name || 'Sem tipo',
        pool_total: it.type_pool || 0,
        printer_count: 0,
        totalCurrent: 0,
        totalSuggested: 0,
        totalApproved: 0,
      };
    }
    byType[key].printer_count += 1;
    byType[key].totalCurrent += it.current_limit || 0;
    byType[key].totalSuggested += it.suggested_limit || 0;
    byType[key].totalApproved += final;
  }

  // Calcula deltas e flags de "estouro"
  const totalsByType = Object.values(byType).map(t => ({
    ...t,
    deltaApproved: t.totalApproved - t.totalCurrent,
    deltaSuggested: t.totalSuggested - t.totalCurrent,
    poolUsagePctApproved: t.pool_total > 0 ? Math.round((t.totalApproved / t.pool_total) * 1000) / 10 : 0,
    poolUsagePctSuggested: t.pool_total > 0 ? Math.round((t.totalSuggested / t.pool_total) * 1000) / 10 : 0,
    overflowApproved: t.pool_total > 0 && t.totalApproved > t.pool_total,
    overflowSuggested: t.pool_total > 0 && t.totalSuggested > t.pool_total,
  }));

  return {
    totalCurrent,
    totalSuggested,
    totalApproved,
    deltaSuggested: totalSuggested - totalCurrent,
    deltaApproved: totalApproved - totalCurrent,
    byType: totalsByType,
  };
}

function listProposals({ limit = 24 } = {}) {
  return db.prepare(`
    SELECT qp.id, qp.period, qp.status, qp.generated_at, qp.approved_at, qp.applied_at,
           gu.name as generated_by_name,
           au.name as approved_by_name,
           (SELECT COUNT(*) FROM quota_proposal_items qpi WHERE qpi.proposal_id = qp.id) as item_count
    FROM quota_proposals qp
    LEFT JOIN users gu ON qp.generated_by_user_id = gu.id
    LEFT JOIN users au ON qp.approved_by_user_id = au.id
    ORDER BY qp.period DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Edita o approved_limit de um item especifico.
 * Reabre a proposta para 'draft' se ja estava 'pending' ou 'rejected'.
 */
function updateItemApprovedLimit(proposalId, itemId, approvedLimit, userId) {
  const item = db.prepare('SELECT * FROM quota_proposal_items WHERE id = ? AND proposal_id = ?')
    .get(itemId, proposalId);
  if (!item) throw new Error('Item nao encontrado');

  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(proposalId);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada - nao pode ser editada');

  const value = approvedLimit == null ? null : Math.max(0, Math.min(999999, parseInt(approvedLimit, 10)));
  db.prepare('UPDATE quota_proposal_items SET approved_limit = ? WHERE id = ?').run(value, itemId);

  // Se editou, volta status para draft (precisara aprovar de novo)
  if (proposal.status !== 'draft') {
    db.prepare(`
      UPDATE quota_proposals
      SET status = 'draft', approved_by_user_id = NULL, approved_at = NULL,
          rejected_at = NULL
      WHERE id = ?
    `).run(proposalId);
  }

  return getProposal(proposalId);
}

/**
 * Edita varios approved_limit em batch. updates = [{itemId, approvedLimit}, ...]
 */
function bulkUpdateItems(proposalId, updates, userId) {
  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(proposalId);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada');

  const stmt = db.prepare('UPDATE quota_proposal_items SET approved_limit = ? WHERE id = ? AND proposal_id = ?');
  const tx = db.transaction(() => {
    for (const u of updates) {
      const v = u.approvedLimit == null ? null : Math.max(0, Math.min(999999, parseInt(u.approvedLimit, 10)));
      stmt.run(v, u.itemId, proposalId);
    }
    if (proposal.status !== 'draft') {
      db.prepare(`
        UPDATE quota_proposals
        SET status = 'draft', approved_by_user_id = NULL, approved_at = NULL,
            rejected_at = NULL
        WHERE id = ?
      `).run(proposalId);
    }
  });
  tx();
  return getProposal(proposalId);
}

/**
 * Aplica os mesmos approved_limit como suggested_limit para itens com NULL.
 * Util quando admin clica "Aplicar sugestoes a todos".
 */
function fillApprovedFromSuggested(proposalId) {
  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(proposalId);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada');
  db.prepare(`
    UPDATE quota_proposal_items
    SET approved_limit = suggested_limit
    WHERE proposal_id = ? AND approved_limit IS NULL
  `).run(proposalId);
  return getProposal(proposalId);
}

function approveProposal(id, userId) {
  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(id);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada');

  // Garante que todos os itens tem approved_limit definido
  fillApprovedFromSuggested(id);

  db.prepare(`
    UPDATE quota_proposals
    SET status = 'approved', approved_by_user_id = ?,
        approved_at = datetime('now','-3 hours'), rejected_at = NULL
    WHERE id = ?
  `).run(userId || null, id);

  return getProposal(id);
}

function rejectProposal(id, userId, notes) {
  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(id);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada');

  db.prepare(`
    UPDATE quota_proposals
    SET status = 'rejected', rejected_at = datetime('now','-3 hours'),
        approved_by_user_id = ?, notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(userId || null, notes || null, id);

  return getProposal(id);
}

/**
 * Aplica a proposta aprovada para o periodo recebido (chamado pelo
 * resetMonth do printerControlService no dia 1).
 *
 * Para cada item, faz UPSERT em quotas (period = period, monthly_limit =
 * approved_limit ou suggested_limit como fallback).
 *
 * Retorna { applied, applicableItems, errors }.
 */
function applyApprovedProposal(period) {
  const proposal = db.prepare(`
    SELECT * FROM quota_proposals WHERE period = ? AND status = 'approved'
  `).get(period);
  if (!proposal) {
    return { applied: false, reason: 'no-approved-proposal', items: [] };
  }

  const items = getProposalItems(proposal.id);
  const errors = [];

  const tx = db.transaction(() => {
    for (const it of items) {
      const finalLimit = it.approved_limit ?? it.suggested_limit;
      // Pega sector_id do printer no momento da aplicacao
      const printer = db.prepare('SELECT sector_id FROM printers WHERE id = ?').get(it.printer_id);
      if (!printer || !printer.sector_id) {
        errors.push({ printer_id: it.printer_id, error: 'sem sector_id' });
        continue;
      }

      // UPSERT: se ja existe quota para esse periodo, atualiza; senao cria.
      const existing = db.prepare(`
        SELECT id FROM quotas WHERE printer_id = ? AND sector_id = ? AND period = ?
      `).get(it.printer_id, printer.sector_id, period);

      if (existing) {
        db.prepare('UPDATE quotas SET monthly_limit = ?, current_usage = 0 WHERE id = ?')
          .run(finalLimit, existing.id);
      } else {
        db.prepare(`
          INSERT INTO quotas (printer_id, sector_id, monthly_limit, current_usage, period)
          VALUES (?, ?, ?, 0, ?)
        `).run(it.printer_id, printer.sector_id, finalLimit, period);
      }
    }

    db.prepare(`
      UPDATE quota_proposals
      SET status = 'applied', applied_at = datetime('now','-3 hours')
      WHERE id = ?
    `).run(proposal.id);
  });

  tx();
  return {
    applied: true,
    proposalId: proposal.id,
    period,
    items: items.length,
    errors,
  };
}

function deleteProposal(id) {
  const proposal = db.prepare('SELECT * FROM quota_proposals WHERE id = ?').get(id);
  if (!proposal) throw new Error('Proposta nao encontrada');
  if (proposal.status === 'applied') throw new Error('Proposta ja aplicada - nao pode ser deletada');
  db.prepare('DELETE FROM quota_proposals WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = {
  getCurrentPeriod,
  getNextPeriod,
  generateProposal,
  getProposal,
  getProposalByPeriod,
  listProposals,
  updateItemApprovedLimit,
  bulkUpdateItems,
  fillApprovedFromSuggested,
  approveProposal,
  rejectProposal,
  applyApprovedProposal,
  deleteProposal,
};
