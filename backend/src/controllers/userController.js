const userService = require('../services/userService');

function getAll(req, res, next) {
  try {
    const users = userService.getAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const user = userService.getById(req.params.id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const user = userService.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: true, message: 'Nome de usuário já existe' });
    }
    next(err);
  }
}

function update(req, res, next) {
  try {
    const user = userService.update(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: true, message: 'Nome de usuário já existe' });
    }
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const user = userService.remove(req.params.id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
    res.json({ message: 'Usuário removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
