// Log de auditoria — registra ações sensíveis (RF15/RNF03).
// Falhas de auditoria nunca derrubam a operação principal (RNF07).
const prisma = require('../infrastructure/prisma');

async function registrar({ usuarioId = null, acao, entidade, entidadeId = null, detalhe = null }) {
  try {
    await prisma.logAuditoria.create({
      data: { usuarioId, acao, entidade, entidadeId, detalhe }
    });
  } catch (erro) {
    console.error('[auditoria] falha ao registrar log:', erro.message);
  }
}

async function listar({ entidade = null, entidadeId = null, page = 1, limit = 10 }) {
  const where = {};
  if (entidade) where.entidade = entidade;
  if (entidadeId) where.entidadeId = entidadeId;

  const [total, dados] = await Promise.all([
    prisma.logAuditoria.count({ where }),
    prisma.logAuditoria.findMany({
      where,
      orderBy: { dataHora: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { usuario: { select: { id: true, nome: true, perfil: true } } }
    })
  ]);

  return { dados, pagina: page, limite: limit, total, totalPaginas: Math.ceil(total / limit) };
}

module.exports = { registrar, listar };
