// Camada de acesso à API — wrapper de fetch com token JWT e
// normalização do padrão de erro da API ({ error, message, details }).
(function () {
  'use strict';

  const CHAVE_TOKEN = 'rn_token';

  function token() {
    return localStorage.getItem(CHAVE_TOKEN) || null;
  }

  function guardarToken(valor) {
    if (valor) localStorage.setItem(CHAVE_TOKEN, valor);
    else localStorage.removeItem(CHAVE_TOKEN);
  }

  // Requisição genérica: api.requisicao('GET', '/pedidos?status=PRONTO')
  async function requisicao(metodo, caminho, corpo) {
    const cabecalhos = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) cabecalhos.Authorization = `Bearer ${t}`;

    const resposta = await fetch(caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });

    // 204 sem conteúdo
    if (resposta.status === 204) return null;

    let dados = null;
    try { dados = await resposta.json(); } catch (_) { /* corpo vazio */ }

    if (!resposta.ok) {
      const erro = new Error((dados && dados.message) || `Erro ${resposta.status}`);
      erro.status = resposta.status;
      erro.codigo = dados && dados.error;
      erro.detalhes = (dados && dados.details) || [];
      throw erro;
    }

    return dados;
  }

  window.api = {
    token,
    guardarToken,
    get: (caminho) => requisicao('GET', caminho),
    post: (caminho, corpo) => requisicao('POST', caminho, corpo),
    put: (caminho, corpo) => requisicao('PUT', caminho, corpo),
    patch: (caminho, corpo) => requisicao('PATCH', caminho, corpo),
    del: (caminho) => requisicao('DELETE', caminho)
  };
})();
