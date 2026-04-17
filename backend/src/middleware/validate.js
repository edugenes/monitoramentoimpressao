const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: 'Dados invalidos',
      details: errors.array(),
    });
  }
  next();
}

module.exports = validate;
