const router = require('express').Router();
const pagamentoService = require('../../application/pagamentoService');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// POST /pagamentos — solicita pagamento mock e registra o resultado (CLIENTE ou ATENDENTE)
router.post('/', requireAuth, requirePerfil('CLIENTE', 'ATENDENTE'), async (req, res, next) => {
  try {
    const resultado = await pagamentoService.solicitar(req.body || {}, req.usuario);
    res.status(201).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// GET /pagamentos/{id} — consulta o pagamento (dono do pedido ou perfis internos)
router.get('/:id', requireAuth, requirePerfil('CLIENTE', 'ATENDENTE', 'GERENTE'), async (req, res, next) => {
  try {
    const pagamento = await pagamentoService.consultar(req.params.id, req.usuario);
    res.status(200).json(pagamento);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
