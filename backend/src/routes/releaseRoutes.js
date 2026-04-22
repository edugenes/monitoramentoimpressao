const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/releaseController');

const router = Router();

router.get('/', controller.getAll);

router.post('/',
  requireAdmin,
  body('quota_id').isInt().withMessage('Cota e obrigatoria'),
  body('amount').isInt({ min: 1 }).withMessage('Quantidade deve ser maior que zero'),
  validate,
  controller.create
);

module.exports = router;
