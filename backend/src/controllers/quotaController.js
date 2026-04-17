const quotaService = require('../services/quotaService');

function getAll(req, res, next) {
  try {
    const filters = {
      printer_id: req.query.printer_id,
      sector_id: req.query.sector_id,
      period: req.query.period,
    };
    const quotas = quotaService.getAll(filters);
    res.json(quotas);
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const quota = quotaService.getById(req.params.id);
    if (!quota) return res.status(404).json({ error: true, message: 'Cota nao encontrada' });
    res.json(quota);
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const quota = quotaService.create(req.body);
    res.status(201).json(quota);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: true,
        message: 'Ja existe uma cota para esta impressora/setor neste periodo',
      });
    }
    next(err);
  }
}

function update(req, res, next) {
  try {
    const quota = quotaService.update(req.params.id, req.body);
    if (!quota) return res.status(404).json({ error: true, message: 'Cota nao encontrada' });
    res.json(quota);
  } catch (err) {
    next(err);
  }
}

function getStatus(req, res, next) {
  try {
    const status = quotaService.getStatus(req.params.id);
    if (!status) return res.status(404).json({ error: true, message: 'Cota nao encontrada' });
    res.json(status);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, getStatus };
