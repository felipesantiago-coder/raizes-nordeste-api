require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yaml');
const handlerErro = require('./api/middlewares/erro');
const { erroNaoEncontrado } = require('./domain/erros');

const app = express();

app.use(express.json());

// Documentação OpenAPI/Swagger gerada a partir do contrato real
const documentoOpenapi = yaml.parse(
  fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8')
);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(documentoOpenapi));

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
app.use('/produtos', require('./api/routes/produtos'));
app.use('/estoque', require('./api/routes/estoque'));
app.use('/pedidos', require('./api/routes/pedidos'));
app.use('/pagamentos', require('./api/routes/pagamentos'));
app.use('/fidelidade', require('./api/routes/fidelidade'));
app.use('/logs', require('./api/routes/logs'));

// Rota inexistente → 404 no padrão
app.use((req, res, next) => {
  next(erroNaoEncontrado(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
});

// Erros sempre no padrão único
app.use(handlerErro);

module.exports = app;
