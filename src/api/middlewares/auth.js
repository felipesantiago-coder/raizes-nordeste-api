// Middlewares de autenticação (JWT) e autorização por perfil (RF01/RNF01).
const jwt = require('jsonwebtoken');
const { erroAutenticacao, erroPermissao } = require('../../domain/erros');

// Exige "Authorization: Bearer <token>" válido
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return next(erroAutenticacao());
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.sub, perfil: payload.perfil, nome: payload.nome };
    next();
  } catch (erro) {
    next(erroAutenticacao());
  }
}

// Restringe a rota aos perfis informados, ex.: requirePerfil('GERENTE')
function requirePerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(erroAutenticacao());
    }
    if (!perfis.includes(req.usuario.perfil)) {
      return next(erroPermissao());
    }
    next();
  };
}

module.exports = { requireAuth, requirePerfil };
