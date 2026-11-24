const router = require('express').Router();
const fidelidadeService = require('../../application/fidelidadeService');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// GET /fidelidade/saldo — saldo de pontos do cliente autenticado
router.get('/saldo', requireAuth, requirePerfil('CLIENTE'), async (req, res, next) => {
  try {
    const resultado = await fidelidadeService.saldo(req.usuario);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// GET /fidelidade/lancamentos — histórico de acúmulos e resgates
router.get('/lancamentos', requireAuth, requirePerfil('CLIENTE'), async (req, res, next) => {
  try {
    const resultado = await fidelidadeService.lancamentos(req.usuario, req.query);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// POST /fidelidade/resgates — resgate simples (CLIENTE)
router.post('/resgates', requireAuth, requirePerfil('CLIENTE'), async (req, res, next) => {
  try {
    const resultado = await fidelidadeService.resgatar(req.usuario, req.body || {});
    res.status(201).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
