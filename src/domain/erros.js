// Erros de domínio — todo erro da API nasce aqui e sai no formato padrão:
// { error, message, details, timestamp, path }
class AppError extends Error {
  constructor(status, error, message, details = []) {
    super(message);
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

module.exports = {
  AppError,

  // 422 — requisição sintaticamente ok, mas conteúdo inválido
  erroValidacao: (message, details = []) => new AppError(422, 'VALIDACAO_INVALIDA', message, details),

  // 400 — requisição malformada
  erroRequisicao: (message, details = []) => new AppError(400, 'REQUISICAO_INVALIDA', message, details),

  // 401 — não autenticado / credenciais erradas
  erroAutenticacao: (message = 'Token ausente ou inválido.') =>
    new AppError(401, 'NAO_AUTENTICADO', message),
  erroCredenciais: (message = 'E-mail ou senha inválidos.') =>
    new AppError(401, 'CREDENCIAIS_INVALIDAS', message),

  // 403 — autenticado, mas sem permissão
  erroPermissao: (message = 'Seu perfil não tem permissão para esta operação.') =>
    new AppError(403, 'SEM_PERMISSAO', message),

  // 404 — recurso inexistente
  erroNaoEncontrado: (message = 'Recurso não encontrado.') =>
    new AppError(404, 'NAO_ENCONTRADO', message),

  // 409 — conflito com regra de negócio (o nome do erro identifica a regra)
  erroConflito: (error, message, details = []) => new AppError(409, error, message, details)
};
