// Caso de uso: listar unidades ativas da rede (RF02).
const prisma = require('../infrastructure/prisma');
const { parsePaginacao, montarResultado } = require('./paginacao');

async function listar(query) {
  const { page, limit, skip, take } = parsePaginacao(query);

  const where = { ativa: true };
  const [total, dados] = await Promise.all([
    prisma.unidade.count({ where }),
    prisma.unidade.findMany({ where, orderBy: { nome: 'asc' }, skip, take })
  ]);

  return montarResultado(dados, total, page, limit);
}

module.exports = { listar };
