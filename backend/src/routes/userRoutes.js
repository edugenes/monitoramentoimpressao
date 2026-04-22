const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/userController');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.post('/',
  body('username').notEmpty().withMessage('Nome de usuário é obrigatório'),
  body('name').notEmpty().withMessage('Nome completo é obrigatório'),
  body('password').isLength({ min: 4 }).withMessage('Senha deve ter no mínimo 4 caracteres'),
  body('role').isIn(['admin', 'gestor']).withMessage('Perfil deve ser admin ou gestor'),
  validate,
  controller.create
);

router.put('/:id',
  body('username').notEmpty().withMessage('Nome de usuário é obrigatório'),
  body('name').notEmpty().withMessage('Nome completo é obrigatório'),
  body('role').isIn(['admin', 'gestor']).withMessage('Perfil deve ser admin ou gestor'),
  validate,
  controller.update
);

router.delete('/:id', controller.remove);

module.exports = router;
