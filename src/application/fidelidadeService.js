// Programa de fidelização (RF12/RF13, RN08/RN09):
// 1 ponto a cada R$ 10 em pedidos pagos; resgate em múltiplos de 100 pontos
// (100 pontos = R$ 10 de desconto). Tudo condicionado ao consentimento LGPD.
const prisma = require('../infrastructure/prisma');
const logService = require('./logService');
const { erroConflito, erroValidacao } = require('../domain/erros');
const { inteiroPositivo } = require('../domain/validacoes');

// Chamado DENTRO da transação do pagamento aprovado — o acúmulo nunca
// acontece sem o pagamento e vice-versa. Sem consentimento, não acumula (RN08).
async function acumularNoPedido(tx, pedido) {
  if (!pedido.clienteId) {
    return { pontosAcumulados: 0, motivo: 'pedido sem cliente identificado' };
  }

  const cliente = await tx.usuario.findUnique({ where: { id: pedido.clienteId } });
  if (!cliente || !cliente.dataConsentimento) {
    return { pontosAcumulados: 0, motivo: 'cliente sem consentimento LGPD para fidelidade' };
  }

  const pontos = Math.floor(pedido.total / 10);
  if (pontos <= 0) {
    return { pontosAcumulados: 0, motivo: 'valor abaixo do mínimo para acumular' };
  }

  await tx.contaFidelidade.upsert({
    where: { clienteId: cliente.id },
    update: { saldoPontos: { increment: pontos } },
    create: { clienteId: cliente.id, saldoPontos: pontos }
  });

  await tx.lancamentoFidelidade.create({
    data: {
      clienteId: cliente.id,
      pedidoId: pedido.id,
      tipo: 'ACUMULO',
      pontos,
      descricao: `Acúmulo do pedido #${pedido.id} (1 ponto a cada R$ 10)`
    }
  });

  return { pontosAcumulados: pontos, motivo: null };
}

// Saldo e situação do consentimento do cliente autenticado
async function saldo(usuario) {
  const [cliente, conta] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuario.id } }),
    prisma.contaFidelidade.findUnique({ where: { clienteId: usuario.id } })
  ]);

  return {
    clienteId: usuario.id,
    consentimentoFidelidade: Boolean(cliente && cliente.dataConsentimento),
    versaoTermo: cliente ? cliente.versaoTermo : null,
    saldoPontos: conta ? conta.saldoPontos : 0
  };
}

// Histórico de acúmulos e resgates
async function lancamentos(usuario, query) {
  const { parsePaginacao, montarResultado } = require('./paginacao');
  const { page, limit, skip, take } = parsePaginacao(query);
  const where = { clienteId: usuario.id };

  const [total, dados] = await Promise.all([
    prisma.lancamentoFidelidade.count({ where }),
    prisma.lancamentoFidelidade.findMany({ where, orderBy: { dataHora: 'desc' }, skip, take })
  ]);

  return montarResultado(dados, total, page, limit);
}

// Resgate simples (RN09): múltiplo de 100, com saldo e consentimento
async function resgatar(usuario, dados) {
  const cliente = await prisma.usuario.findUnique({ where: { id: usuario.id } });
  if (!cliente || !cliente.dataConsentimento) {
    throw erroConflito(
      'FIDELIDADE_SEM_CONSENTIMENTO',
      'Cliente não aderiu ao programa de fidelidade; o resgate exige consentimento LGPD.'
    );
  }

  const pontos = inteiroPositivo(dados.pontos, 'pontos');
  if (pontos < 100 || pontos % 100 !== 0) {
    throw erroValidacao('O resgate deve ser um múltiplo de 100 pontos (mínimo 100).', [
      { field: 'pontos', issue: `valor recebido: ${pontos}` }
    ]);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const conta = await tx.contaFidelidade.findUnique({ where: { clienteId: usuario.id } });
    const saldoAtual = conta ? conta.saldoPontos : 0;

    if (saldoAtual < pontos) {
      const { erroConflito: conflito } = require('../domain/erros');
      throw conflito('SALDO_INSUFICIENTE', 'Saldo de pontos insuficiente para esse resgate.', [
        { field: 'pontos', issue: `Disponível: ${saldoAtual} pontos` }
      ]);
    }

    await tx.contaFidelidade.update({
      where: { clienteId: usuario.id },
      data: { saldoPontos: { decrement: pontos } }
    });

    return tx.lancamentoFidelidade.create({
      data: {
        clienteId: usuario.id,
        tipo: 'RESGATE',
        pontos,
        descricao: `Resgate de ${pontos} pontos (cupom de R$ ${(pontos / 10).toFixed(2)})`
      }
    });
  });

  const saldoFinal = await prisma.contaFidelidade.findUnique({ where: { clienteId: usuario.id } });

  await logService.registrar({
    usuarioId: usuario.id,
    acao: 'RESGATE_FIDELIDADE',
    entidade: 'ContaFidelidade',
    entidadeId: usuario.id,
    detalhe: `resgate de ${pontos} pontos`
  });

  return {
    lancamentoId: resultado.id,
    pontosResgatados: pontos,
    cupomDesconto: `R$ ${(pontos / 10).toFixed(2)}`,
    saldoPontos: saldoFinal ? saldoFinal.saldoPontos : 0,
    dataHora: resultado.dataHora
  };
}

module.exports = { acumularNoPedido, saldo, lancamentos, resgatar };
