const { Router } = require('express');
const controller = require('../controllers/alertController');
const { requireAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', controller.getAll);
router.get('/count', controller.getCount);
router.post('/:id/acknowledge', controller.acknowledge);
router.post('/acknowledge-all', controller.acknowledgeAll);

// Reprocessa manualmente (admin)
router.post('/generate', requireAdmin, controller.generateNow);

module.exports = router;
