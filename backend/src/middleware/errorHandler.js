function errorHandler(err, req, res, next) {
  console.error('Erro:', err.message);
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  res.status(status).json({
    error: true,
    message,
  });
}

function notFound(req, res) {
  res.status(404).json({
    error: true,
    message: 'Rota nao encontrada',
  });
}

module.exports = { errorHandler, notFound };
