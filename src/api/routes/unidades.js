const router = require('express').Router();
const unidadeService = require('../../application/unidadeService');

// GET /unidades — lista unidades ativas (público, paginado)
router.get('/', async (req, res, next) => {
  try {
    const resultado = await unidadeService.listar(req.query);
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
