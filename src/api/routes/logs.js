const router = require('express').Router();
const logService = require('../../application/logService');
const { parsePaginacao } = require('../../application/paginacao');
const { requireAuth, requirePerfil } = require('../middlewares/auth');

// GET /logs?entidade=&entidadeId= — auditoria de ações sensíveis (GERENTE)
router.get('/', requireAuth, requirePerfil('GERENTE'), async (req, res, next) => {
  try {
    const { page, limit } = parsePaginacao(req.query);
    const resultado = await logService.listar({
      entidade: req.query.entidade,
      entidadeId: req.query.entidadeId,
      page,
      limit
    });
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
