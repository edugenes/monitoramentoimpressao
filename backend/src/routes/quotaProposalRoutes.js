const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/quotaProposalController');

const router = Router();

// Leitura: qualquer usuario autenticado
router.get('/', controller.listProposals);
router.get('/period/:period', controller.getProposalByPeriod);
router.get('/:id', controller.getProposal);

// Escrita: admin only
router.post('/generate',
  requireAdmin,
  body('period').optional().matches(/^\d{4}-\d{2}$/).withMessage('period deve ser YYYY-MM'),
  validate,
  controller.generateProposal,
);

router.put('/:id/items/:itemId',
  requireAdmin,
  body('approved_limit').optional({ nullable: true }).isInt({ min: 0 }).withMessage('approved_limit deve ser inteiro'),
  validate,
  controller.updateItem,
);

router.put('/:id/items',
  requireAdmin,
  body('updates').isArray().withMessage('updates deve ser array'),
  validate,
  controller.bulkUpdateItems,
);

router.post('/:id/fill-suggested', requireAdmin, controller.fillSuggested);
router.post('/:id/approve', requireAdmin, controller.approveProposal);
router.post('/:id/reject', requireAdmin, controller.rejectProposal);
router.delete('/:id', requireAdmin, controller.deleteProposal);

module.exports = router;
