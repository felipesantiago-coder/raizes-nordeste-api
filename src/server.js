const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Raízes do Nordeste rodando em http://localhost:${PORT}`);
});
