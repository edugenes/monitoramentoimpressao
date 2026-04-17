const reportService = require('../services/reportService');

function bySector(req, res, next) {
  try {
    const period = req.query.period;
    const week = req.query.week ? parseInt(req.query.week) : 0;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const data = reportService.bySector(period, week);
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
    const data = reportService.byPrinter(period, week);
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
    const data = reportService.releasesReport(period, week);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function summary(req, res, next) {
  try {
    const period = req.query.period;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const data = reportService.summary(period);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { bySector, byPrinter, releases, summary };
