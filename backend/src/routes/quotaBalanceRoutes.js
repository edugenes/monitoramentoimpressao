const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/quotaBalanceController');

const router = Router();

// Leitura: gestor pode ver (filtrado por setor) e admin ve tudo
router.get('/overview', controller.getOverview);
router.get('/by-sector', controller.getBySector);
router.get('/printers', controller.listPrinters);
router.get('/divergences', controller.getDivergences);

// Escrita: admin only
router.post('/rebalance',
  requireAdmin,
  body('from_printer_id').isInt().withMessage('from_printer_id e obrigatorio'),
  body('to_printer_id').isInt().withMessage('to_printer_id e obrigatorio'),
  body('amount').isInt({ min: 1 }).withMessage('amount deve ser positivo'),
  validate,
  controller.rebalance,
);

module.exports = router;
