// Handler central de erros — garante o padrão único de resposta em toda a API:
// { error, message, details, timestamp, path }
const { AppError } = require('../../domain/erros');

function handlerErro(erro, req, res, next) {
  if (erro instanceof AppError) {
    return res.status(erro.status).json({
      error: erro.error,
      message: erro.message,
      details: erro.details,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }

  // Erros conhecidos do Prisma mapeados para o padrão
  if (erro && erro.code === 'P2025') {
    return res.status(404).json({
      error: 'NAO_ENCONTRADO',
      message: 'Registro não encontrado.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }
  if (erro && erro.code === 'P2002') {
    return res.status(409).json({
      error: 'REGISTRO_DUPLICADO',
      message: 'Já existe um registro com esse valor único.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }

  // Erro inesperado — loga no servidor sem vazar detalhes para o cliente
  console.error('[erro inesperado]', erro);
  return res.status(500).json({
    error: 'ERRO_INTERNO',
    message: 'Erro interno do servidor.',
    details: [],
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
}

module.exports = handlerErro;
