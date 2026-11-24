// Casos de uso de pedidos — o núcleo do fluxo crítico (RF07 a RF10, RN01 a RN06).
const prisma = require('../infrastructure/prisma');
const logService = require('./logService');
const { parsePaginacao, montarResultado } = require('./paginacao');
const {
  erroNaoEncontrado,
  erroConflito,
  erroValidacao
} = require('../domain/erros');
const {
  campoObrigatorio,
  dentroDaLista,
  inteiroPositivo,
  CANAIS_PEDIDO,
  STATUS_PEDIDO,
  validarTransicaoStatus
} = require('../domain/validacoes');

function formatarPedido(pedido) {
  return {
    pedidoId: pedido.id,
    canalPedido: pedido.canalPedido,
    status: pedido.status,
    total: pedido.total,
    unidade: pedido.unidade,
    cliente: pedido.cliente,
    itens: pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario
    })),
    criadoEm: pedido.criadoEm,
    atualizadoEm: pedido.atualizadoEm
  };
}

// POST /pedidos — cria pedido validando estoque, com canalPedido obrigatório (RN01)
async function criar(dados, usuario) {
  campoObrigatorio(dados.canalPedido, 'canalPedido');
  dentroDaLista(dados.canalPedido, 'canalPedido', CANAIS_PEDIDO);

  const unidadeId = inteiroPositivo(dados.unidadeId, 'unidadeId');
  campoObrigatorio(dados.itens, 'itens');
  if (!Array.isArray(dados.itens) || dados.itens.length === 0) {
    throw erroValidacao('O pedido precisa de pelo menos um item.', [
      { field: 'itens', issue: 'lista vazia' }
    ]);
  }

  // CLIENTE sempre pede para si; ATENDENTE pode indicar um clienteId (ou não)
  let clienteId = null;
  if (usuario.perfil === 'CLIENTE') {
    clienteId = usuario.id;
  } else if (dados.clienteId !== undefined && dados.clienteId !== null) {
    clienteId = inteiroPositivo(dados.clienteId, 'clienteId');
  }

  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade || !unidade.ativa) {
    throw erroNaoEncontrado('Unidade não encontrada ou inativa.');
  }

  if (clienteId) {
    const cliente = await prisma.usuario.findUnique({ where: { id: clienteId } });
    if (!cliente || cliente.perfil !== 'CLIENTE') {
      throw erroNaoEncontrado('Cliente não encontrado.');
    }
  }

  // Validação de itens: sem repetição, produto existe, disponível e com saldo (RN02–RN04)
  const produtoIds = dados.itens.map((i) => inteiroPositivo(i.produtoId, 'itens[].produtoId'));
  if (new Set(produtoIds).size !== produtoIds.length) {
    throw erroValidacao('Cada produto deve aparecer uma única vez no pedido.', [
      { field: 'itens', issue: 'produtoId repetido' }
    ]);
  }

  const itensValidados = [];
  for (const item of dados.itens) {
    const produtoId = inteiroPositivo(item.produtoId, 'itens[].produtoId');
    const quantidade = inteiroPositivo(item.quantidade, 'itens[].quantidade');

    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) {
      throw erroNaoEncontrado(`Produto ${produtoId} não encontrado.`);
    }
    if (!produto.disponivel) {
      throw erroConflito('PRODUTO_INDISPONIVEL', `O produto "${produto.nome}" está indisponível.`);
    }

    const estoque = await prisma.estoque.findUnique({
      where: { unidadeId_produtoId: { unidadeId, produtoId } }
    });
    const saldo = estoque ? estoque.quantidade : 0;
    if (saldo < quantidade) {
      throw erroConflito('ESTOQUE_INSUFICIENTE', 'Não há quantidade suficiente para um ou mais itens.', [
        { field: `itens[produtoId=${produtoId}].quantidade`, issue: `Disponível: ${saldo}` }
      ]);
    }

    itensValidados.push({ produtoId, quantidade, precoUnitario: produto.precoUnitario });
  }

  // Total sempre calculado no servidor (RN02) com preço congelado (RN03)
  const total = Math.round(itensValidados.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) * 100) / 100;

  // Pedido + baixa de estoque numa única transação (RNF08)
  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        unidadeId,
        clienteId,
        canalPedido: dados.canalPedido,
        status: 'AGUARDANDO_PAGAMENTO',
        total,
        itens: {
          create: itensValidados.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario
          }))
        }
      },
      include: { itens: true }
    });

    for (const item of itensValidados) {
      await tx.estoque.update({
        where: { unidadeId_produtoId: { unidadeId, produtoId: item.produtoId } },
        data: { quantidade: { decrement: item.quantidade } }
      });
    }

    return criado;
  });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'PEDIDO_CRIADO',
    entidade: 'Pedido',
    entidadeId: pedido.id,
    detalhe: `${itensValidados.length} item(ns), total R$ ${total.toFixed(2)}, canal ${dados.canalPedido}, unidade ${unidadeId}`
  });

  return {
    pedidoId: pedido.id,
    status: pedido.status,
    canalPedido: pedido.canalPedido,
    unidadeId: pedido.unidadeId,
    clienteId: pedido.clienteId,
    total: pedido.total,
    itens: pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario
    })),
    criadoEm: pedido.criadoEm
  };
}

// GET /pedidos?canalPedido=&status=&unidadeId= — consulta com filtros de domínio
// CLIENTE vê apenas os próprios pedidos; perfis internos veem todos
async function listar(query, usuario) {
  const { page, limit, skip, take } = parsePaginacao(query);
  const where = {};

  if (usuario.perfil === 'CLIENTE') {
    where.clienteId = usuario.id;
  }
  if (query.canalPedido) {
    dentroDaLista(query.canalPedido, 'canalPedido', CANAIS_PEDIDO);
    where.canalPedido = query.canalPedido;
  }
  if (query.status) {
    dentroDaLista(query.status, 'status', STATUS_PEDIDO);
    where.status = query.status;
  }
  if (query.unidadeId) {
    where.unidadeId = inteiroPositivo(query.unidadeId, 'unidadeId');
  }

  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take,
      include: {
        unidade: { select: { id: true, nome: true } },
        cliente: { select: { id: true, nome: true } },
        itens: true
      }
    })
  ]);

  return montarResultado(pedidos.map(formatarPedido), total, page, limit);
}

// PATCH /pedidos/{id}/status — transições válidas por perfil (RN05/RN06)
async function atualizarStatus(idBruto, novoStatus, usuario) {
  const id = inteiroPositivo(idBruto, 'id');

  const pedido = await prisma.pedido.findUnique({ where: { id }, include: { itens: true } });
  if (!pedido) {
    throw erroNaoEncontrado('Pedido não encontrado.');
  }

  // CLIENTE só mexe no próprio pedido (e só para cancelar, ver RN05)
  if (usuario.perfil === 'CLIENTE' && pedido.clienteId !== usuario.id) {
    throw erroNaoEncontrado('Pedido não encontrado.');
  }

  validarTransicaoStatus(pedido.status, novoStatus, usuario.perfil);

  if (novoStatus === 'CANCELADO') {
    // RN06 — cancelamento devolve os itens ao estoque da unidade
    await prisma.$transaction(async (tx) => {
      for (const item of pedido.itens) {
        await tx.estoque.upsert({
          where: { unidadeId_produtoId: { unidadeId: pedido.unidadeId, produtoId: item.produtoId } },
          update: { quantidade: { increment: item.quantidade } },
          create: { unidadeId: pedido.unidadeId, produtoId: item.produtoId, quantidade: item.quantidade, minimo: 0 }
        });
      }
      await tx.pedido.update({ where: { id }, data: { status: novoStatus } });
    });
  } else {
    await prisma.pedido.update({ where: { id }, data: { status: novoStatus } });
  }

  await logService.registrar({
    usuarioId: usuario.id,
    acao: novoStatus === 'CANCELADO' ? 'PEDIDO_CANCELADO' : 'STATUS_ATUALIZADO',
    entidade: 'Pedido',
    entidadeId: id,
    detalhe: `${pedido.status} -> ${novoStatus}`
  });

  return { pedidoId: id, statusAnterior: pedido.status, status: novoStatus };
}

module.exports = { criar, listar, atualizarStatus };
