// Casos de uso de usuários: cadastro público de CLIENTE com consentimento
// LGPD e consulta de perfil com auditoria de acesso (RF01, RF13, RNF02).
const bcrypt = require('bcryptjs');
const prisma = require('../infrastructure/prisma');
const logService = require('./logService');
const { erroConflito, erroPermissao, erroNaoEncontrado } = require('../domain/erros');
const { campoObrigatorio, emailValido, senhaValida, inteiroPositivo } = require('../domain/validacoes');

const VERSAO_TERMO_FIDELIDADE = '1.0';

// Nunca devolve senhaHash — LGPD/minimização (RNF02)
function semDadosSensiveis(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    dataConsentimento: usuario.dataConsentimento,
    versaoTermo: usuario.versaoTermo,
    criadoEm: usuario.criadoEm
  };
}

async function cadastrar({ nome, email, senha, aceitaFidelidade }) {
  campoObrigatorio(nome, 'nome');
  const emailNormalizado = emailValido(email);
  senhaValida(senha);

  const existente = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });
  if (existente) {
    throw erroConflito('EMAIL_JA_CADASTRADO', 'Já existe uma conta com este e-mail.');
  }

  const consentiu = aceitaFidelidade === true;

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      email: emailNormalizado,
      senhaHash: await bcrypt.hash(senha, 10),
      perfil: 'CLIENTE', // cadastro público é sempre de cliente
      dataConsentimento: consentiu ? new Date() : null,
      versaoTermo: consentiu ? VERSAO_TERMO_FIDELIDADE : null
    }
  });

  // Só existe conta de fidelidade com consentimento registrado (RN08)
  if (consentiu) {
    await prisma.contaFidelidade.create({
      data: { clienteId: usuario.id, saldoPontos: 0 }
    });
  }

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'CADASTRO_USUARIO',
    entidade: 'Usuario',
    entidadeId: usuario.id,
    detalhe: consentiu ? 'consentiu com a fidelidade (termo 1.0)' : 'sem consentimento para fidelidade'
  });

  return semDadosSensiveis(usuario);
}

async function consultarPorId(idBruto, usuarioAutenticado) {
  const id = inteiroPositivo(idBruto, 'id');

  if (usuarioAutenticado.perfil !== 'GERENTE' && usuarioAutenticado.id !== id) {
    throw erroPermissao('Você só pode consultar o próprio perfil.');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw erroNaoEncontrado('Usuário não encontrado.');
  }

  // LGPD: acesso a dados pessoais é ação sensível — registra auditoria (RNF03)
  await logService.registrar({
    usuarioId: usuarioAutenticado.id,
    acao: 'ACESSO_DADOS_PESSOAIS',
    entidade: 'Usuario',
    entidadeId: id,
    detalhe: usuarioAutenticado.id === id ? 'autoconsulta' : 'consulta por GERENTE'
  });

  return semDadosSensiveis(usuario);
}

module.exports = { cadastrar, consultarPorId };
