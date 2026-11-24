const router = require('express').Router();
const usuarioService = require('../../application/usuarioService');
const { requireAuth } = require('../middlewares/auth');

// POST /usuarios — cadastro público de cliente (com consentimento LGPD opcional)
router.post('/', async (req, res, next) => {
  try {
    const usuario = await usuarioService.cadastrar(req.body || {});
    res.status(201).json(usuario);
  } catch (erro) {
    next(erro);
  }
});

// GET /usuarios/{id} — o próprio perfil ou GERENTE (auditoria de acesso)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const usuario = await usuarioService.consultarPorId(req.params.id, req.usuario);
    res.status(200).json(usuario);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
