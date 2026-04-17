const sectorService = require('../services/sectorService');

function getAll(req, res, next) {
  try {
    const sectors = sectorService.getAll();
    res.json(sectors);
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const sector = sectorService.getById(req.params.id);
    if (!sector) return res.status(404).json({ error: true, message: 'Setor nao encontrado' });
    res.json(sector);
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const sector = sectorService.create(req.body);
    res.status(201).json(sector);
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const sector = sectorService.update(req.params.id, req.body);
    if (!sector) return res.status(404).json({ error: true, message: 'Setor nao encontrado' });
    res.json(sector);
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const sector = sectorService.remove(req.params.id);
    if (!sector) return res.status(404).json({ error: true, message: 'Setor nao encontrado' });
    res.json({ message: 'Setor desativado com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
