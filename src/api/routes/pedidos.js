const router = require('express').Router();
const pedidoService = require('../../application/pedidoService');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// POST /pedidos — cria pedido (CLIENTE ou ATENDENTE), canalPedido obrigatório
router.post('/', requireAuth, requirePerfil('CLIENTE', 'ATENDENTE'), async (req, res, next) => {
  try {
    const pedido = await pedidoService.criar(req.body || {}, req.usuario);
    res.status(201).json(pedido);
  } catch (erro) {
    next(erro);
  }
});

// GET /pedidos?canalPedido=&status= — consulta e filtro por canal/status
router.get('/', requireAuth, requirePerfil('CLIENTE', 'ATENDENTE', 'COZINHA', 'GERENTE'), async (req, res, next) => {
  try {
    const resultado = await pedidoService.listar(req.query, req.usuario);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// PATCH /pedidos/{id}/status — avança o status ou cancela (COZINHA/ATENDENTE/GERENTE; CLIENTE cancela o próprio)
router.patch('/:id/status', requireAuth, requirePerfil('CLIENTE', 'ATENDENTE', 'COZINHA', 'GERENTE'), async (req, res, next) => {
  try {
    const resultado = await pedidoService.atualizarStatus(req.params.id, (req.body || {}).status, req.usuario);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
