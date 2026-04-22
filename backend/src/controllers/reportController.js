const reportService = require('../services/reportService');
const { getSectorFilter } = require('../middleware/auth');

function bySector(req, res, next) {
  try {
    const period = req.query.period;
    const week = req.query.week ? parseInt(req.query.week) : 0;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const sectorIds = getSectorFilter(req);
    const data = reportService.bySector(period, week, sectorIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function byPrinter(req, res, next) {
  try {
    const period = req.query.period;
    const week = req.query.week ? parseInt(req.query.week) : 0;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const sectorIds = getSectorFilter(req);
    const data = reportService.byPrinter(period, week, sectorIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function releases(req, res, next) {
  try {
    const period = req.query.period;
    const week = req.query.week ? parseInt(req.query.week) : 0;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const sectorIds = getSectorFilter(req);
    const data = reportService.releasesReport(period, week, sectorIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function summary(req, res, next) {
  try {
    const period = req.query.period;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const sectorIds = getSectorFilter(req);
    const data = reportService.summary(period, sectorIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { bySector, byPrinter, releases, summary };
