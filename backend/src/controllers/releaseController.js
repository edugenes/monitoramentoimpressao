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
    const payload = {
      ...req.body,
      created_by_user_id: req.user?.id || null,
    };
    const release = releaseService.create(payload);
    res.status(201).json(release);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create };
