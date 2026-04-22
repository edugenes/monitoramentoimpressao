const authService = require('../services/authService');

function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: true, message: 'Usuário e senha são obrigatórios' });
    }
    const result = authService.login(username, password);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: true, message: err.message });
    next(err);
  }
}

function me(req, res, next) {
  try {
    const user = authService.getMe(req.user.id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me };
