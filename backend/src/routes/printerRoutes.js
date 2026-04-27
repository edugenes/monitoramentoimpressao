const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/printerController');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.post('/',
  requireAdmin,
  body('name').notEmpty().withMessage('Nome e obrigatorio'),
  validate,
  controller.create
);

router.put('/:id',
  requireAdmin,
  body('name').notEmpty().withMessage('Nome e obrigatorio'),
  validate,
  controller.update
);

router.delete('/:id', requireAdmin, controller.remove);

router.post('/:id/sync-quota', requireAdmin, controller.syncQuota);
router.post('/:id/block', requireAdmin, controller.blockPrinter);
router.post('/:id/unblock', requireAdmin, controller.unblockPrinter);
router.get('/:id/block-events', requireAdmin, controller.getBlockEvents);

module.exports = router;
