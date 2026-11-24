// Validações e enumerações do domínio.
// Como o Prisma/SQLite não suporta ENUM, os valores permitidos vivem aqui
// e toda escrita passa por estas funções — é o "ENUM" do sistema.
const { erroValidacao } = require('./erros');

const PERFIS = ['CLIENTE', 'ATENDENTE', 'COZINHA', 'GERENTE'];
const CANAIS_PEDIDO = ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'];
const STATUS_PEDIDO = ['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];
const TIPOS_MOVIMENTO = ['ENTRADA', 'SAIDA'];
const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'CARTAO', 'CARTAO_RECUSADO'];

// Transições de status permitidas e quem pode executar cada uma (RN05)
const TRANSICOES_STATUS = {
  AGUARDANDO_PAGAMENTO: {
    CANCELADO: ['CLIENTE', 'ATENDENTE', 'GERENTE'] // antes do início da preparação (RN06)
  },
  EM_PREPARO: {
    PRONTO: ['COZINHA', 'GERENTE']
  },
  PRONTO: {
    ENTREGUE: ['ATENDENTE', 'GERENTE']
  },
  ENTREGUE: {},
  CANCELADO: {}
};

function campoObrigatorio(valor, campo) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    throw erroValidacao(`O campo ${campo} é obrigatório.`, [{ field: campo, issue: 'valor ausente' }]);
  }
  return valor;
}

function dentroDaLista(valor, campo, lista) {
  if (!lista.includes(valor)) {
    throw erroValidacao(`O campo ${campo} deve ser um de: ${lista.join(', ')}.`, [
      { field: campo, issue: `valor recebido: "${valor}"` }
    ]);
  }
  return valor;
}

function inteiroPositivo(valor, campo, minimo = 1) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo) {
    throw erroValidacao(`O campo ${campo} deve ser um número inteiro maior ou igual a ${minimo}.`, [
      { field: campo, issue: `valor recebido: "${valor}"` }
    ]);
  }
  return numero;
}

function valorMonetarioPositivo(valor, campo) {
  const numero = Number(valor);
  if (typeof numero !== 'number' || !Number.isFinite(numero) || numero <= 0) {
    throw erroValidacao(`O campo ${campo} deve ser um valor positivo.`, [
      { field: campo, issue: `valor recebido: "${valor}"` }
    ]);
  }
  return numero;
}

function emailValido(email) {
  campoObrigatorio(email, 'email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw erroValidacao('O campo email deve ser um e-mail válido.', [
      { field: 'email', issue: `valor recebido: "${email}"` }
    ]);
  }
  return email.toLowerCase();
}

function senhaValida(senha) {
  campoObrigatorio(senha, 'senha');
  if (typeof senha !== 'string' || senha.length < 8) {
    throw erroValidacao('A senha deve ter pelo menos 8 caracteres.', [
      { field: 'senha', issue: 'mínimo de 8 caracteres' }
    ]);
  }
  return senha;
}

// Valida a mudança de status: primeiro se a transição existe, depois se o perfil pode executá-la
function validarTransicaoStatus(statusAtual, novoStatus, perfil) {
  campoObrigatorio(novoStatus, 'status');
  dentroDaLista(novoStatus, 'status', STATUS_PEDIDO);

  if (novoStatus === statusAtual) {
    const { erroConflito } = require('./erros');
    throw erroConflito('TRANSICAO_STATUS_INVALIDA', `O pedido já está em ${statusAtual}.`);
  }

  const caminhos = TRANSICOES_STATUS[statusAtual] || {};
  if (!(novoStatus in caminhos)) {
    const { erroConflito } = require('./erros');
    let mensagem = `Não é possível ir de ${statusAtual} para ${novoStatus}.`;
    if (statusAtual === 'AGUARDANDO_PAGAMENTO' && novoStatus === 'EM_PREPARO') {
      mensagem = 'O pedido só sai de AGUARDANDO_PAGAMENTO pelo pagamento (POST /pagamentos).';
    }
    throw erroConflito('TRANSICAO_STATUS_INVALIDA', mensagem);
  }

  if (!caminhos[novoStatus].includes(perfil)) {
    const { erroPermissao } = require('./erros');
    throw erroPermissao(`Somente ${caminhos[novoStatus].join(' ou ')} pode mover ${statusAtual} para ${novoStatus}.`);
  }
}

module.exports = {
  PERFIS,
  CANAIS_PEDIDO,
  STATUS_PEDIDO,
  TIPOS_MOVIMENTO,
  STATUS_PAGAMENTO,
  FORMAS_PAGAMENTO,
  TRANSICOES_STATUS,
  campoObrigatorio,
  dentroDaLista,
  inteiroPositivo,
  valorMonetarioPositivo,
  emailValido,
  senhaValida,
  validarTransicaoStatus
};
