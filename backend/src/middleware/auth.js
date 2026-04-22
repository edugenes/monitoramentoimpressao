const authService = require('../services/authService');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Token não fornecido' });
  }

  try {
    const token = header.slice(7);
    const decoded = authService.verifyToken(token);
    const sectors = authService.getUserSectors(decoded.id);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      sectors,
    };
    next();
  } catch {
    return res.status(401).json({ error: true, message: 'Token inválido ou expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: true, message: 'Acesso restrito a administradores' });
  }
  next();
}

function getSectorFilter(req) {
  if (req.user.role === 'admin') return null;
  return req.user.sectors;
}

module.exports = { authenticate, requireAdmin, getSectorFilter };
