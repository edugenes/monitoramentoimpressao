const service = require('../services/printerTypeService');

function getAll(req, res, next) {
  try {
    res.json(service.getAll());
  } catch (err) {
    next(err);
  }
}

function getStatus(req, res, next) {
  try {
    const period = req.query.period || getCurrentPeriod();
    res.json(service.getPoolStatus(period));
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { monthly_pool, name } = req.body;
    const payload = {
      monthly_pool: monthly_pool !== undefined ? parseInt(monthly_pool, 10) : undefined,
      name,
    };
    const updated = service.update(id, payload);
    if (!updated) {
      return res.status(404).json({ error: true, message: 'Tipo de impressora nao encontrado' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { getAll, getStatus, update };
