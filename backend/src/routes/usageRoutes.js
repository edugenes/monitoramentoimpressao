const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const controller = require('../controllers/usageController');

const router = Router();

router.get('/quota/:quotaId', controller.getByQuota);

router.post('/',
  body('quota_id').isInt().withMessage('Cota e obrigatoria'),
  body('pages_used').isInt({ min: 1 }).withMessage('Quantidade de paginas deve ser maior que zero'),
  validate,
  controller.register
);

module.exports = router;
