/**
 * Orquestra o bloqueio nativo da impressora HP via "Cota Local".
 *
 * Fluxo:
 *   syncQuotaToPrinter(printerId) ->
 *     1. Le quota do periodo atual + soma de releases
 *     2. Calcula creditos = max(0, monthly_limit + releases - current_usage)
 *     3. Se creditos == ultimo valor sincronizado, no-op
 *     4. Empurra creditos para contas Convidado e Outros via EWS
 *     5. Se creditos == 0: tenta mensagem "COTA ESGOTADA" no painel via SNMP SET
 *     6. Atualiza printers.last_quota_sync_* e grava printer_block_events
 *
 * Acionado por:
 *   - snmpService.updateQuotaUsage (cada coleta)
 *   - releaseService.create (criar liberacao)
 *   - scheduler rollover (virada do mes)
 *   - rotas POST /printers/:id/sync-quota (manual)
 */
const db = require('../config/db');
const ewsClient = require('./hpEwsCotaLocalClient');
const snmpService = require('./snmpService');

const AUTO_SYNC_ENABLED = String(process.env.AUTO_SYNC_ENABLED || 'false').toLowerCase() === 'true';

// Contas que o sistema sincroniza automaticamente. Usamos os IDs internos do
// firmware HP (em ingles); o cliente EWS aceita aliases PT-BR (Convidado/Outros)
// se a frota tiver firmware com nomes traduzidos.
// Administrator (Administrador) NUNCA e tocado por este servico.
const ACCOUNTS_TO_SYNC = ['Guest', 'Others'];

// Mensagens do painel
const MSG_BLOCKED = 'COTA ESGOTADA - PROCURE TI';
const MSG_FREE = '';

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function logEvent({ printerId, action, creditsBefore, creditsAfter, success, error, triggeredBy }) {
  try {
    db.prepare(`
      INSERT INTO printer_block_events (printer_id, action, credits_before, credits_after, success, error, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      printerId,
      action,
      creditsBefore ?? null,
      creditsAfter ?? null,
      success ? 1 : 0,
      error ? String(error).slice(0, 500) : null,
      triggeredBy || null
    );
  } catch (err) {
    console.warn('[printerControl] Falha ao gravar evento:', err.message);
  }
}

function getPrinter(printerId) {
  return db.prepare('SELECT * FROM printers WHERE id = ?').get(printerId);
}

function getQuotaState(printerId) {
  const period = getCurrentPeriod();
  const quota = db.prepare(`
    SELECT id, monthly_limit, current_usage, sector_id
    FROM quotas
    WHERE printer_id = ? AND period = ?
  `).get(printerId, period);

  if (!quota) return null;

  const releasesSum = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM releases WHERE quota_id = ?
  `).get(quota.id).total;

  const creditsRemaining = Math.max(0, quota.monthly_limit + releasesSum - quota.current_usage);
  return { period, quotaId: quota.id, monthlyLimit: quota.monthly_limit, usage: quota.current_usage, releases: releasesSum, creditsRemaining };
}

function isManualUnblockActive(printer) {
  if (!printer.manual_unblock_until) return false;
  const until = new Date(printer.manual_unblock_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/**
 * Sincroniza creditos da impressora com a Cota Local via EWS.
 * Retorna { skipped, reason } ou { success, credits, results }.
 */
async function syncQuotaToPrinter(printerId, opts = {}) {
  const triggeredBy = opts.triggeredBy || 'unknown';
  const force = opts.force === true;

  const printer = getPrinter(printerId);
  if (!printer) return { skipped: true, reason: 'printer-not-found' };
  if (!printer.active) return { skipped: true, reason: 'printer-inactive' };
  if (!printer.ip_address) return { skipped: true, reason: 'printer-no-ip' };
  if (!printer.quota_sync_enabled && !force) return { skipped: true, reason: 'sync-disabled-on-printer' };
  if (!AUTO_SYNC_ENABLED && !force) return { skipped: true, reason: 'auto-sync-globally-disabled' };

  const state = getQuotaState(printerId);
  if (!state) return { skipped: true, reason: 'no-quota-for-period' };

  const credits = state.creditsRemaining;
  const lastSent = printer.last_quota_sync_credits;

  if (lastSent === credits && !force) {
    return { skipped: true, reason: 'no-change', credits };
  }

  // Se admin reativou manualmente, nao re-bloqueia automaticamente ate vencer
  if (credits === 0 && isManualUnblockActive(printer) && !force) {
    return { skipped: true, reason: 'manual-unblock-active', credits, until: printer.manual_unblock_until };
  }

  const entries = ACCOUNTS_TO_SYNC.map(account => ({ account, credits }));

  let ewsResult;
  try {
    ewsResult = await ewsClient.setUserQuotaBatch(printer.ip_address, entries);
  } catch (err) {
    ewsResult = { success: false, error: err.message };
  }

  // Mensagem do painel - best effort
  let panelResult = null;
  try {
    const goingToBlock = credits === 0 && (lastSent == null || lastSent > 0);
    const goingToUnblock = credits > 0 && lastSent === 0;
    if (goingToBlock) {
      panelResult = await snmpService.setControlPanelMessage(printer.ip_address, printer.snmp_community, MSG_BLOCKED);
    } else if (goingToUnblock) {
      panelResult = await snmpService.clearControlPanelMessage(printer.ip_address, printer.snmp_community);
    }
  } catch (err) {
    panelResult = { success: false, error: err.message };
  }

  const success = ewsResult.success === true;

  // Persiste estado
  try {
    db.prepare(`
      UPDATE printers
      SET last_quota_sync_at = datetime('now', '-3 hours'),
          last_quota_sync_credits = CASE WHEN ? = 1 THEN ? ELSE last_quota_sync_credits END,
          last_quota_sync_error = ?
      WHERE id = ?
    `).run(
      success ? 1 : 0,
      credits,
      success ? null : (ewsResult.error || JSON.stringify(ewsResult.results || {}).slice(0, 500)),
      printerId
    );
  } catch (err) {
    console.warn('[printerControl] Falha ao atualizar printer:', err.message);
  }

  logEvent({
    printerId,
    action: 'sync',
    creditsBefore: lastSent,
    creditsAfter: success ? credits : lastSent,
    success,
    error: success ? null : (ewsResult.error || JSON.stringify(ewsResult.results || {})),
    triggeredBy,
  });

  return { success, credits, results: ewsResult.results, panelResult };
}

/**
 * Reset (zera o "usado" no contador de cota da propria impressora).
 * Chamado no rollover mensal: queremos que a impressora veja "credito cheio"
 * para o novo mes, independente do que tinha antes.
 */
async function resetMonth({ triggeredBy, period } = {}) {
  // 1. Aplica proposta aprovada (se houver) ANTES de tocar nas HPs.
  //    Isso garante que as quotas do novo periodo ja estejam com os
  //    monthly_limit aprovados quando o syncQuotaToPrinter rodar logo
  //    em seguida. Lazy require para evitar circular.
  let proposalApplied = null;
  try {
    const targetPeriod = period || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    const quotaProposalService = require('./quotaProposalService');
    const result = quotaProposalService.applyApprovedProposal(targetPeriod);
    if (result.applied) {
      console.log(`[printerControl] Proposta ${result.proposalId} aplicada para ${targetPeriod}: ${result.items} itens`);
      proposalApplied = result;
    } else {
      console.log(`[printerControl] Sem proposta aprovada para ${targetPeriod} - mantendo limites do periodo anterior`);
    }
  } catch (err) {
    console.warn(`[printerControl] Falha ao aplicar proposta aprovada: ${err.message}`);
  }

  const printers = db.prepare(`
    SELECT * FROM printers
    WHERE active = 1
      AND ip_address IS NOT NULL AND ip_address != ''
      AND quota_sync_enabled = 1
  `).all();

  const results = [];
  for (const printer of printers) {
    let allOk = true;
    const errors = [];
    for (const account of ACCOUNTS_TO_SYNC) {
      try {
        const r = await ewsClient.resetUserQuota(printer.ip_address, account);
        if (!r.success) { allOk = false; errors.push(`${account}: ${r.status || r.error}`); }
      } catch (err) {
        allOk = false;
        errors.push(`${account}: ${err.message}`);
      }
    }

    // Limpa manual_unblock_until: novo mes, novas regras
    try {
      db.prepare(`UPDATE printers SET manual_unblock_until = NULL WHERE id = ?`).run(printer.id);
    } catch { /* ignore */ }

    logEvent({
      printerId: printer.id,
      action: 'reset',
      creditsBefore: null,
      creditsAfter: null,
      success: allOk,
      error: allOk ? null : errors.join('; '),
      triggeredBy: triggeredBy || 'rollover',
    });

    results.push({ printerId: printer.id, name: printer.name, success: allOk, errors });

    // Apos reset, sincroniza com o estado atual (creditos da nova cota do mes)
    if (allOk) {
      try {
        await syncQuotaToPrinter(printer.id, { triggeredBy: 'rollover', force: true });
      } catch (err) {
        console.warn(`[printerControl] sync pos-reset falhou em ${printer.name}: ${err.message}`);
      }
    }
  }

  return { processed: results.length, results, proposalApplied };
}

/**
 * Bloqueio manual: forca creditos = 0 imediatamente.
 */
async function manualBlock(printerId, triggeredBy) {
  const printer = getPrinter(printerId);
  if (!printer) throw new Error('printer-not-found');
  if (!printer.ip_address) throw new Error('printer-no-ip');

  const entries = ACCOUNTS_TO_SYNC.map(account => ({ account, credits: 0 }));
  const r = await ewsClient.setUserQuotaBatch(printer.ip_address, entries);

  let panel = null;
  try {
    panel = await snmpService.setControlPanelMessage(printer.ip_address, printer.snmp_community, MSG_BLOCKED);
  } catch (err) { panel = { success: false, error: err.message }; }

  if (r.success) {
    db.prepare(`
      UPDATE printers
      SET last_quota_sync_at = datetime('now', '-3 hours'),
          last_quota_sync_credits = 0,
          last_quota_sync_error = NULL,
          manual_unblock_until = NULL
      WHERE id = ?
    `).run(printerId);
  }

  logEvent({
    printerId,
    action: 'manual_block',
    creditsBefore: printer.last_quota_sync_credits,
    creditsAfter: r.success ? 0 : printer.last_quota_sync_credits,
    success: r.success,
    error: r.success ? null : JSON.stringify(r.results || r.error),
    triggeredBy: triggeredBy || 'admin',
  });

  return { success: r.success, panel, results: r.results };
}

/**
 * Desbloqueio manual: empurra creditos = (monthlyLimit + releases - usage)
 * mesmo sendo zero - se usuario quer "religar mesmo assim", definimos um teto
 * minimo de seguranca (`overrideCredits` se passado).
 *
 * Tambem grava `manual_unblock_until` (24h) para impedir que o sync automatico
 * volte a zerar logo na proxima coleta.
 */
async function manualUnblock(printerId, { overrideCredits, triggeredBy } = {}) {
  const printer = getPrinter(printerId);
  if (!printer) throw new Error('printer-not-found');
  if (!printer.ip_address) throw new Error('printer-no-ip');

  const state = getQuotaState(printerId);
  let credits = state ? state.creditsRemaining : (overrideCredits || 0);
  if (overrideCredits != null) credits = overrideCredits;
  if (credits <= 0) credits = overrideCredits != null ? overrideCredits : 1; // pelo menos 1 para liberar

  const entries = ACCOUNTS_TO_SYNC.map(account => ({ account, credits }));
  const r = await ewsClient.setUserQuotaBatch(printer.ip_address, entries);

  let panel = null;
  try {
    panel = await snmpService.clearControlPanelMessage(printer.ip_address, printer.snmp_community);
  } catch (err) { panel = { success: false, error: err.message }; }

  if (r.success) {
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    db.prepare(`
      UPDATE printers
      SET last_quota_sync_at = datetime('now', '-3 hours'),
          last_quota_sync_credits = ?,
          last_quota_sync_error = NULL,
          manual_unblock_until = ?
      WHERE id = ?
    `).run(credits, until, printerId);
  }

  logEvent({
    printerId,
    action: 'manual_unblock',
    creditsBefore: printer.last_quota_sync_credits,
    creditsAfter: r.success ? credits : printer.last_quota_sync_credits,
    success: r.success,
    error: r.success ? null : JSON.stringify(r.results || r.error),
    triggeredBy: triggeredBy || 'admin',
  });

  return { success: r.success, credits, panel, results: r.results };
}

function getBlockEvents(printerId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT * FROM printer_block_events
    WHERE printer_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(printerId, Math.min(limit, 500));
}

module.exports = {
  syncQuotaToPrinter,
  resetMonth,
  manualBlock,
  manualUnblock,
  getBlockEvents,
  AUTO_SYNC_ENABLED,
};
