// Padrão de paginação das listagens (RNF06): ?page=1&limit=10, máximo de 100.
const { erroValidacao } = require('../domain/erros');

function parsePaginacao(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw erroValidacao('O parâmetro page deve ser um inteiro maior ou igual a 1.', [
      { field: 'page', issue: `valor recebido: "${query.page}"` }
    ]);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw erroValidacao('O parâmetro limit deve ser um inteiro entre 1 e 100.', [
      { field: 'limit', issue: `valor recebido: "${query.limit}"` }
    ]);
  }

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

function montarResultado(dados, total, page, limit) {
  return {
    dados,
    pagina: page,
    limite: limit,
    total,
    totalPaginas: Math.ceil(total / limit)
  };
}

module.exports = { parsePaginacao, montarResultado };
