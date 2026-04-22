const alertService = require('../services/alertService');
const { getSectorFilter } = require('../middleware/auth');

function getAll(req, res, next) {
  try {
    const sectorIds = getSectorFilter(req);
    const onlyUnacknowledged = req.query.unacknowledged === 'true';
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const alerts = alertService.getAll({ sectorIds, onlyUnacknowledged, limit });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

function getCount(req, res, next) {
  try {
    const sectorIds = getSectorFilter(req);
    const counts = alertService.getUnacknowledgedCount(sectorIds);
    res.json(counts);
  } catch (err) {
    next(err);
  }
}

function acknowledge(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = alertService.acknowledge(id, req.user.id);
    if (!ok) return res.status(404).json({ error: true, message: 'Alerta não encontrado ou já reconhecido' });
    res.json({ message: 'Alerta reconhecido' });
  } catch (err) {
    next(err);
  }
}

function acknowledgeAll(req, res, next) {
  try {
    const sectorIds = getSectorFilter(req);
    const changed = alertService.acknowledgeAll(req.user.id, sectorIds);
    res.json({ message: `${changed} alertas reconhecidos`, changed });
  } catch (err) {
    next(err);
  }
}

function generateNow(req, res, next) {
  try {
    const result = alertService.generateAlerts();
    res.json({ message: 'Verificacao manual concluida', ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getCount, acknowledge, acknowledgeAll, generateNow };
