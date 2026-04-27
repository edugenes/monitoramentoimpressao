const quotaBalanceService = require('../services/quotaBalanceService');
const { getSectorFilter } = require('../middleware/auth');

function getOverview(req, res, next) {
  try {
    const period = req.query.period || undefined;
    res.json(quotaBalanceService.getOverview(period));
  } catch (err) { next(err); }
}

function getBySector(req, res, next) {
  try {
    const period = req.query.period || undefined;
    res.json(quotaBalanceService.getBySector(period));
  } catch (err) { next(err); }
}

function listPrinters(req, res, next) {
  try {
    const period = req.query.period || undefined;
    const sectorIds = getSectorFilter(req);
    res.json(quotaBalanceService.listPrinters(period, {
      sectorIds,
      status: req.query.status || undefined,
      search: req.query.search || undefined,
    }));
  } catch (err) { next(err); }
}

async function getDivergences(req, res, next) {
  try {
    const ids = req.query.printer_ids
      ? String(req.query.printer_ids).split(',').map(s => parseInt(s, 10)).filter(Boolean)
      : null;
    const result = await quotaBalanceService.getDivergences({
      printerIds: ids,
      onlySyncEnabled: req.query.only_sync_enabled === 'true',
      sample: req.query.sample === 'true',
    });
    res.json(result);
  } catch (err) { next(err); }
}

function rebalance(req, res, next) {
  try {
    const { from_printer_id, to_printer_id, amount, reason } = req.body || {};
    const r = quotaBalanceService.rebalance({
      fromPrinterId: parseInt(from_printer_id, 10),
      toPrinterId: parseInt(to_printer_id, 10),
      amount: parseInt(amount, 10),
      reason,
      userId: req.user?.id,
    });
    res.json(r);
  } catch (err) {
    if (
      err.message?.includes('insuficiente') ||
      err.message?.includes('tipos diferentes') ||
      err.message?.includes('sem tipo definido') ||
      err.message?.includes('iguais') ||
      err.message?.includes('nao encontrada')
    ) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

module.exports = {
  getOverview,
  getBySector,
  listPrinters,
  getDivergences,
  rebalance,
};
