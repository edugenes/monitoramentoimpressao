const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/printerTypeController');

const router = Router();

router.get('/', controller.getAll);
router.get('/status', controller.getStatus);

router.put(
  '/:id',
  requireAdmin,
  body('monthly_pool').optional().isInt({ min: 0 }).withMessage('monthly_pool deve ser um inteiro maior ou igual a zero'),
  body('name').optional().isString().trim().notEmpty().withMessage('name nao pode ser vazio'),
  validate,
  controller.update
);

module.exports = router;
