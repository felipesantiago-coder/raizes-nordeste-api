// Entrada serverless para o deploy na Vercel: a MESMA aplicação Express
// usada localmente (API + interface web + Swagger), sem duplicação de código.
const app = require('../src/app');

module.exports = (req, res) => {
  // A reescrita do vercel.json envia o caminho original em ?caminho=...
  // (funciona tanto se a plataforma preservar a URL original quanto se
  // entregar /api/index). Acesso direto à função cai na interface.
  const url = new URL(req.url, 'http://interno');
  if (url.pathname === '/api' || url.pathname === '/api/index') {
    const caminho = url.searchParams.get('caminho');
    if (caminho) {
      url.searchParams.delete('caminho');
      const consulta = url.searchParams.toString();
      req.url = `/${caminho}${consulta ? `?${consulta}` : ''}`;
    } else {
      req.url = '/';
    }
  }
  return app(req, res);
};
