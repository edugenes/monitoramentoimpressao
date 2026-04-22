const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/quotaController');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/status', controller.getStatus);

router.post('/',
  requireAdmin,
  body('printer_id').isInt().withMessage('Impressora e obrigatoria'),
  body('monthly_limit').isInt({ min: 0 }).withMessage('Limite deve ser um numero positivo'),
  validate,
  controller.create
);

router.put('/:id',
  requireAdmin,
  body('monthly_limit').isInt({ min: 0 }).withMessage('Limite deve ser um numero positivo'),
  validate,
  controller.update
);

module.exports = router;
