const router = require('express').Router();
const produtoService = require('../../application/produtoService');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// GET /produtos?unidadeId= — cardápio por unidade (público, paginado)
// sem unidadeId → lista geral de produtos
router.get('/', async (req, res, next) => {
  try {
    const resultado = req.query.unidadeId
      ? await produtoService.listarCardapioPorUnidade(req.query.unidadeId, req.query)
      : await produtoService.listar(req.query);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// POST /produtos — cria produto (GERENTE)
router.post('/', requireAuth, requirePerfil('GERENTE'), async (req, res, next) => {
  try {
    const produto = await produtoService.criar(req.body || {}, req.usuario);
    res.status(201).json(produto);
  } catch (erro) {
    next(erro);
  }
});

// PUT /produtos/{id} — atualiza produto (GERENTE)
router.put('/:id', requireAuth, requirePerfil('GERENTE'), async (req, res, next) => {
  try {
    const produto = await produtoService.atualizar(req.params.id, req.body || {}, req.usuario);
    res.status(200).json(produto);
  } catch (erro) {
    next(erro);
  }
});

// DELETE /produtos/{id} — exclui produto (GERENTE)
router.delete('/:id', requireAuth, requirePerfil('GERENTE'), async (req, res, next) => {
  try {
    await produtoService.excluir(req.params.id, req.usuario);
    res.status(204).send();
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
