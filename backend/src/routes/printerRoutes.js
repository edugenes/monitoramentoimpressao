const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const controller = require('../controllers/printerController');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.post('/',
  body('name').notEmpty().withMessage('Nome e obrigatorio'),
  validate,
  controller.create
);

router.put('/:id',
  body('name').notEmpty().withMessage('Nome e obrigatorio'),
  validate,
  controller.update
);

router.delete('/:id', controller.remove);

module.exports = router;
