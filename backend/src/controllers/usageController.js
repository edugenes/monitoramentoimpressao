const usageService = require('../services/usageService');

function register(req, res, next) {
  try {
    const log = usageService.register(req.body);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

function getByQuota(req, res, next) {
  try {
    const logs = usageService.getByQuota(req.params.quotaId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, getByQuota };
