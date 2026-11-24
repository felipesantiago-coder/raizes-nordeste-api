// Caso de uso: solicitar pagamento ao gateway mock, registrar o resultado e
// atualizar o status do pedido (RF11, RN05, RN07).
const prisma = require('../infrastructure/prisma');
const gatewayMock = require('../infrastructure/pagamento-mock');
const logService = require('./logService');
const { erroNaoEncontrado, erroConflito } = require('../domain/erros');
const {
  campoObrigatorio,
  dentroDaLista,
  inteiroPositivo,
  FORMAS_PAGAMENTO
} = require('../domain/validacoes');

async function solicitar(dados, usuario) {
  const pedidoId = inteiroPositivo(dados.pedidoId, 'pedidoId');
  campoObrigatorio(dados.formaPagamento, 'formaPagamento');
  dentroDaLista(dados.formaPagamento, 'formaPagamento', FORMAS_PAGAMENTO);

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) {
    throw erroNaoEncontrado('Pedido não encontrado.');
  }

  // CLIENTE só movimenta o próprio pedido; internos movem qualquer um
  if (usuario.perfil === 'CLIENTE' && pedido.clienteId !== usuario.id) {
    throw erroNaoEncontrado('Pedido não encontrado.');
  }

  if (pedido.status !== 'AGUARDANDO_PAGAMENTO') {
    throw erroConflito(
      'PEDIDO_NAO_AGUARDANDO_PAGAMENTO',
      `O pedido está em ${pedido.status}; só é possível pagar pedidos em AGUARDANDO_PAGAMENTO.`
    );
  }

  // Chamada ao serviço externo (mock) — falha do mock não muda o pedido (RNF07)
  const resultado = await gatewayMock.processarPagamento({
    total: pedido.total,
    formaPagamento: dados.formaPagamento
  });

  const novoStatus = resultado.aprovado ? 'EM_PREPARO' : 'AGUARDANDO_PAGAMENTO';

  const pagamento = await prisma.$transaction(async (tx) => {
    const registro = await tx.pagamento.create({
      data: {
        pedidoId,
        formaPagamento: dados.formaPagamento,
        status: resultado.aprovado ? 'APROVADO' : 'RECUSADO',
        mensagem: resultado.mensagem,
        codigoAutorizacao: resultado.codigoAutorizacao
      }
    });

    if (resultado.aprovado) {
      await tx.pedido.update({ where: { id: pedidoId }, data: { status: 'EM_PREPARO' } });
    }

    return registro;
  });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'PAGAMENTO_REGISTRADO',
    entidade: 'Pagamento',
    entidadeId: pagamento.id,
    detalhe: `pedido ${pedidoId}: ${pagamento.status} (${dados.formaPagamento})`
  });

  return {
    pagamento: {
      id: pagamento.id,
      pedidoId: pagamento.pedidoId,
      provedor: pagamento.provedor,
      formaPagamento: pagamento.formaPagamento,
      status: pagamento.status,
      mensagem: pagamento.mensagem,
      codigoAutorizacao: pagamento.codigoAutorizacao,
      dataHora: pagamento.dataHora
    },
    pedido: {
      pedidoId,
      status: novoStatus,
      total: pedido.total
    }
  };
}

// GET /pagamentos/{id} — envolvidos no pedido (dono ou perfis internos)
async function consultar(idBruto, usuario) {
  const id = inteiroPositivo(idBruto, 'id');

  const pagamento = await prisma.pagamento.findUnique({
    where: { id },
    include: { pedido: { select: { id: true, clienteId: true, total: true, status: true } } }
  });

  if (!pagamento) {
    throw erroNaoEncontrado('Pagamento não encontrado.');
  }

  if (usuario.perfil === 'CLIENTE' && pagamento.pedido.clienteId !== usuario.id) {
    throw erroNaoEncontrado('Pagamento não encontrado.');
  }

  return pagamento;
}

module.exports = { solicitar, consultar };
