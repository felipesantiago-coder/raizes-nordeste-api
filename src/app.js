require('dotenv').config();

const express = require('express');
const handlerErro = require('./api/middlewares/erro');
const { erroNaoEncontrado } = require('./domain/erros');

const app = express();

app.use(express.json());

// Healthcheck simples
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    servico: 'API Raízes do Nordeste',
    timestamp: new Date().toISOString()
  });
});

// Rotas por recurso (montadas conforme o desenvolvimento avança)
app.use('/auth', require('./api/routes/auth'));
app.use('/usuarios', require('./api/routes/usuarios'));
app.use('/unidades', require('./api/routes/unidades'));

// Rota inexistente → 404 no padrão
app.use((req, res, next) => {
  next(erroNaoEncontrado(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
});

// Erros sempre no padrão único
app.use(handlerErro);

module.exports = app;
