// Gateway de pagamento SIMULADO (RF11, RN07).
// A arquitetura real usa serviços externos; aqui o "serviço" é uma função
// determinística: aprova qualquer forma de pagamento válida, exceto
// CARTAO_RECUSADO — gatilho previsível para o cenário de recusa nos testes.
async function processarPagamento({ total, formaPagamento }) {
  // Simula a latência mínima de uma chamada a um serviço externo
  await new Promise((resolvido) => setTimeout(resolvido, 20));

  if (formaPagamento === 'CARTAO_RECUSADO') {
    return {
      aprovado: false,
      mensagem: 'Pagamento recusado pelo gateway (simulação).',
      codigoAutorizacao: null
    };
  }

  return {
    aprovado: true,
    mensagem: 'Pagamento aprovado (simulação).',
    codigoAutorizacao: `MOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
}

module.exports = { processarPagamento };
