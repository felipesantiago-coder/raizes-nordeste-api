const router = require('express').Router();
const estoqueService = require('../../application/estoqueService');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// GET /estoque/{unidadeId} — saldo por produto (perfis operacionais)
router.get('/:unidadeId', requireAuth, requirePerfil('ATENDENTE', 'COZINHA', 'GERENTE'), async (req, res, next) => {
  try {
    const resultado = await estoqueService.saldoPorUnidade(req.params.unidadeId);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// POST /estoque/movimentos — entrada/saída com rastreabilidade (ATENDENTE ou GERENTE)
router.post('/movimentos', requireAuth, requirePerfil('ATENDENTE', 'GERENTE'), async (req, res, next) => {
  try {
    const resultado = await estoqueService.movimentar(req.body || {}, req.usuario);
    res.status(201).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
