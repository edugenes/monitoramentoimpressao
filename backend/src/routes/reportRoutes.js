const { Router } = require('express');
const controller = require('../controllers/reportController');

const router = Router();

router.get('/by-sector', controller.bySector);
router.get('/by-printer', controller.byPrinter);
router.get('/releases', controller.releases);
router.get('/summary', controller.summary);

module.exports = router;
