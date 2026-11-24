const router = require('express').Router();
const authService = require('../../application/authService');

// POST /auth/login — autentica e devolve o token (público)
router.post('/login', async (req, res, next) => {
  try {
    const resultado = await authService.login(req.body || {});
    res.status(200).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
