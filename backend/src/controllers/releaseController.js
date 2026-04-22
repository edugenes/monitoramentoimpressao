const releaseService = require('../services/releaseService');
const { getSectorFilter } = require('../middleware/auth');

function getAll(req, res, next) {
  try {
    const filters = {
      period: req.query.period,
      printer_id: req.query.printer_id,
      sector_id: req.query.sector_id,
    };
    const sectorIds = getSectorFilter(req);
    const releases = releaseService.getAll(filters, sectorIds);
    res.json(releases);
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const release = releaseService.create(req.body);
    res.status(201).json(release);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create };
