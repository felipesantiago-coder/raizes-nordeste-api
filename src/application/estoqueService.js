// Casos de uso de estoque: saldo por unidade e movimentação com rastreabilidade
// (RF05, RF06 — restrição de venda por indisponibilidade).
const prisma = require('../infrastructure/prisma');
const logService = require('./logService');
const { erroNaoEncontrado, erroConflito } = require('../domain/erros');
const {
  campoObrigatorio,
  inteiroPositivo,
  dentroDaLista,
  TIPOS_MOVIMENTO
} = require('../domain/validacoes');

async function validarUnidade(unidadeId) {
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade) {
    throw erroNaoEncontrado('Unidade não encontrada.');
  }
  return unidade;
}

// Saldo de cada produto na unidade
async function saldoPorUnidade(unidadeIdBruto) {
  const unidadeId = inteiroPositivo(unidadeIdBruto, 'unidadeId');
  const unidade = await validarUnidade(unidadeId);

  const estoques = await prisma.estoque.findMany({
    where: { unidadeId },
    orderBy: { produtoId: 'asc' },
    include: { produto: { select: { id: true, nome: true, categoria: true, disponivel: true } } }
  });

  return {
    unidade: { id: unidade.id, nome: unidade.nome },
    itens: estoques.map((e) => ({
      produtoId: e.produtoId,
      produto: e.produto.nome,
      categoria: e.produto.categoria,
      quantidade: e.quantidade,
      minimo: e.minimo,
      abaixoDoMinimo: e.quantidade < e.minimo
    }))
  };
}

// Entrada ou saída de estoque, com registro de quem movimentou (RF05/RN10)
async function movimentar(dados, usuario) {
  const unidadeId = inteiroPositivo(dados.unidadeId, 'unidadeId');
  const produtoId = inteiroPositivo(dados.produtoId, 'produtoId');
  const quantidade = inteiroPositivo(dados.quantidade, 'quantidade');
  campoObrigatorio(dados.tipo, 'tipo');
  dentroDaLista(dados.tipo, 'tipo', TIPOS_MOVIMENTO);

  const unidade = await validarUnidade(unidadeId);
  const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
  if (!produto) {
    throw erroNaoEncontrado('Produto não encontrado.');
  }

  const saldoAtual = await prisma.estoque.findUnique({
    where: { unidadeId_produtoId: { unidadeId, produtoId } }
  });
  const saldo = saldoAtual ? saldoAtual.quantidade : 0;

  if (dados.tipo === 'SAIDA' && saldo < quantidade) {
    throw erroConflito('ESTOQUE_INSUFICIENTE', 'Não há saldo suficiente para essa saída.', [
      { field: 'quantidade', issue: `Disponível: ${saldo}` }
    ]);
  }

  const movimento = await prisma.$transaction(async (tx) => {
    if (dados.tipo === 'ENTRADA') {
      await tx.estoque.upsert({
        where: { unidadeId_produtoId: { unidadeId, produtoId } },
        update: { quantidade: { increment: quantidade } },
        create: { unidadeId, produtoId, quantidade, minimo: 0 }
      });
    } else {
      await tx.estoque.update({
        where: { unidadeId_produtoId: { unidadeId, produtoId } },
        data: { quantidade: { decrement: quantidade } }
      });
    }

    return tx.movimentoEstoque.create({
      data: {
        unidadeId,
        produtoId,
        tipo: dados.tipo,
        quantidade,
        usuarioId: usuario.id
      }
    });
  });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'ESTOQUE_MOVIMENTADO',
    entidade: 'Estoque',
    entidadeId: produtoId,
    detalhe: `${dados.tipo} de ${quantidade} de "${produto.nome}" na unidade ${unidadeId}`
  });

  return {
    movimentoId: movimento.id,
    unidade: { id: unidade.id, nome: unidade.nome },
    produtoId,
    produto: produto.nome,
    tipo: movimento.tipo,
    quantidade: movimento.quantidade,
    saldoAtual: dados.tipo === 'ENTRADA' ? saldo + quantidade : saldo - quantidade,
    dataHora: movimento.dataHora
  };
}

module.exports = { saldoPorUnidade, movimentar };
