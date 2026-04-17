const { Router } = require('express');
const controller = require('../controllers/snmpController');

const router = Router();

router.get('/status', controller.getStatus);
router.get('/latest', controller.getLatestReadings);
router.get('/readings/:printerId', controller.getReadings);
router.get('/snapshots', controller.getSnapshots);
router.post('/collect', controller.collect);
router.post('/test/:id', controller.testPrinter);
router.post('/close-month', controller.closeMonth);
router.post('/rollover', controller.rolloverMonth);

module.exports = router;
