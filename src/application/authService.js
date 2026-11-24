// Caso de uso: autenticar usuário e devolver token JWT (RF01).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../infrastructure/prisma');
const { erroCredenciais } = require('../domain/erros');
const { campoObrigatorio } = require('../domain/validacoes');

// Converte "8h" / "30m" / "60s" para segundos (para o campo expiresIn da resposta)
function segundosDe(expiracao) {
  const match = /^(\d+)([smh])$/.exec(expiracao || '8h');
  if (!match) return 28800;
  const fator = { s: 1, m: 60, h: 3600 }[match[2]];
  return Number(match[1]) * fator;
}

async function login({ email, senha }) {
  campoObrigatorio(email, 'email');
  campoObrigatorio(senha, 'senha');

  const usuario = await prisma.usuario.findUnique({
    where: { email: String(email).toLowerCase().trim() }
  });

  if (!usuario || !(await bcrypt.compare(String(senha), usuario.senhaHash))) {
    throw erroCredenciais();
  }

  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error('JWT_SECRET não configurado no .env');
  }
  const expiracao = process.env.JWT_EXPIRA_EM || '8h';

  const accessToken = jwt.sign(
    { sub: usuario.id, perfil: usuario.perfil, nome: usuario.nome },
    segredo,
    { expiresIn: expiracao }
  );

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: segundosDe(expiracao),
    user: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil
    }
  };
}

module.exports = { login };
