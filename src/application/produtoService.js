// Casos de uso de produtos: cardápio por unidade (público) e CRUD de
// administração (GERENTE). RF03 e RF04.
const prisma = require('../infrastructure/prisma');
const logService = require('./logService');
const { parsePaginacao, montarResultado } = require('./paginacao');
const { erroNaoEncontrado, erroConflito } = require('../domain/erros');
const {
  campoObrigatorio,
  valorMonetarioPositivo,
  inteiroPositivo
} = require('../domain/validacoes');

async function validarUnidadeAtiva(unidadeId) {
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade || !unidade.ativa) {
    throw erroNaoEncontrado('Unidade não encontrada ou inativa.');
  }
  return unidade;
}

// Cardápio da unidade: produto + saldo disponível naquele local (RF03)
async function listarCardapioPorUnidade(unidadeIdBruto, query) {
  const unidadeId = inteiroPositivo(unidadeIdBruto, 'unidadeId');
  const unidade = await validarUnidadeAtiva(unidadeId);
  const { page, limit, skip, take } = parsePaginacao(query);

  const where = { disponivel: true };
  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip,
      take,
      include: {
        estoques: { where: { unidadeId }, select: { quantidade: true } }
      }
    })
  ]);

  const dados = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    precoUnitario: p.precoUnitario,
    categoria: p.categoria,
    quantidadeDisponivel: p.estoques.length > 0 ? p.estoques[0].quantidade : 0,
    unidade: { id: unidade.id, nome: unidade.nome }
  }));

  return montarResultado(dados, total, page, limit);
}

// Lista geral de produtos (administração, GERENTE)
async function listar(query) {
  const { page, limit, skip, take } = parsePaginacao(query);

  const [total, dados] = await Promise.all([
    prisma.produto.count(),
    prisma.produto.findMany({ orderBy: { nome: 'asc' }, skip, take })
  ]);

  return montarResultado(dados, total, page, limit);
}

async function criar(dados, usuario) {
  campoObrigatorio(dados.nome, 'nome');
  campoObrigatorio(dados.categoria, 'categoria');
  const preco = valorMonetarioPositivo(dados.precoUnitario, 'precoUnitario');

  const produto = await prisma.produto.create({
    data: {
      nome: dados.nome,
      descricao: dados.descricao || null,
      precoUnitario: preco,
      categoria: dados.categoria,
      disponivel: dados.disponivel !== false
    }
  });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'PRODUTO_CRIADO',
    entidade: 'Produto',
    entidadeId: produto.id,
    detalhe: produto.nome
  });

  return produto;
}

async function atualizar(idBruto, dados, usuario) {
  const id = inteiroPositivo(idBruto, 'id');
  const existente = await prisma.produto.findUnique({ where: { id } });
  if (!existente) {
    throw erroNaoEncontrado('Produto não encontrado.');
  }

  const novo = {};
  if (dados.nome !== undefined) novo.nome = campoObrigatorio(dados.nome, 'nome');
  if (dados.descricao !== undefined) novo.descricao = dados.descricao;
  if (dados.precoUnitario !== undefined) novo.precoUnitario = valorMonetarioPositivo(dados.precoUnitario, 'precoUnitario');
  if (dados.categoria !== undefined) novo.categoria = campoObrigatorio(dados.categoria, 'categoria');
  if (dados.disponivel !== undefined) novo.disponivel = dados.disponivel === true;

  const produto = await prisma.produto.update({ where: { id }, data: novo });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'PRODUTO_ATUALIZADO',
    entidade: 'Produto',
    entidadeId: id,
    detalhe: `campos: ${Object.keys(novo).join(', ')}`
  });

  return produto;
}

async function excluir(idBruto, usuario) {
  const id = inteiroPositivo(idBruto, 'id');
  const existente = await prisma.produto.findUnique({ where: { id } });
  if (!existente) {
    throw erroNaoEncontrado('Produto não encontrado.');
  }

  const emPedidos = await prisma.itemPedido.findFirst({ where: { produtoId: id } });
  if (emPedidos) {
    throw erroConflito(
      'PRODUTO_EM_USO',
      'O produto já aparece em pedidos e não pode ser excluído; marque como indisponível.'
    );
  }

  await prisma.$transaction([
    prisma.estoque.deleteMany({ where: { produtoId: id } }),
    prisma.movimentoEstoque.deleteMany({ where: { produtoId: id } }),
    prisma.produto.delete({ where: { id } })
  ]);

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'PRODUTO_EXCLUIDO',
    entidade: 'Produto',
    entidadeId: id,
    detalhe: existente.nome
  });

  return null; // 204
}

module.exports = { listarCardapioPorUnidade, listar, criar, atualizar, excluir };
