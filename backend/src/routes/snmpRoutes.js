const { Router } = require('express');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/snmpController');

const router = Router();

router.get('/status', controller.getStatus);
router.get('/latest', controller.getLatestReadings);
router.get('/readings/:printerId', controller.getReadings);
router.get('/snapshots', controller.getSnapshots);
router.post('/collect', requireAdmin, controller.collect);
router.post('/test/:id', controller.testPrinter);
router.post('/close-month', requireAdmin, controller.closeMonth);
router.post('/rollover', requireAdmin, controller.rolloverMonth);

module.exports = router;
