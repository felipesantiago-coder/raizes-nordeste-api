// Interface web da API Raízes do Nordeste.
// SPA simples em JavaScript nativo: roteamento por hash, sessão em
// localStorage e consumo direto dos endpoints da API.
(function () {
  'use strict';

  // ================= Estado =================
  const estado = {
    usuario: JSON.parse(localStorage.getItem('rn_usuario') || 'null'),
    unidades: [],
    unidadeId: Number(localStorage.getItem('rn_unidade')) || null,
    produtos: [],
    categoria: '',
    carrinho: JSON.parse(localStorage.getItem('rn_carrinho') || '[]'),
    nomesProdutos: {},
    abaPainel: 'estoque'
  };

  const CANAIS = ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'];
  const FORMAS = ['PIX', 'CARTAO', 'DINHEIRO', 'CARTAO_RECUSADO'];

  const rotulosStatus = {
    AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
    EM_PREPARO: 'Em preparo',
    PRONTO: 'Pronto',
    ENTREGUE: 'Entregue',
    CANCELADO: 'Cancelado'
  };

  const classeStatus = {
    AGUARDANDO_PAGAMENTO: 'selo-aguardando',
    EM_PREPARO: 'selo-preparo',
    PRONTO: 'selo-pronto',
    ENTREGUE: 'selo-entregue',
    CANCELADO: 'selo-cancelado'
  };

  const rotulosCanal = { APP: 'App', TOTEM: 'Totem', BALCAO: 'Balcão', PICKUP: 'Pickup', WEB: 'Web' };

  const $ = (seletor) => document.querySelector(seletor);

  const brl = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const dataHora = (iso) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  function ehInterno() {
    return !!estado.usuario && estado.usuario.perfil !== 'CLIENTE';
  }

  function salvarSessao(usuario, token) {
    estado.usuario = usuario;
    api.guardarToken(token);
    localStorage.setItem('rn_usuario', JSON.stringify(usuario));
    atualizarTopbar();
  }

  function sair() {
    estado.usuario = null;
    api.guardarToken(null);
    localStorage.removeItem('rn_usuario');
    atualizarTopbar();
    fecharModal('#modal-auth');
    toast('Você saiu da conta.');
    navegar(location.hash || '#/inicio', true);
  }

  // ================= Toasts =================
  function toast(mensagem, tipo) {
    const elemento = document.createElement('div');
    elemento.className = `toast${tipo ? ' ' + tipo : ''}`;
    elemento.textContent = mensagem;
    $('#toasts').appendChild(elemento);
    setTimeout(() => elemento.remove(), 4200);
  }

  function tratarErro(erro) {
    if (erro.status === 401) {
      estado.usuario = null;
      api.guardarToken(null);
      localStorage.removeItem('rn_usuario');
      atualizarTopbar();
      abrirModalAuth('entrar');
      toast('Sessão expirada — entre novamente.', 'erro');
      return;
    }
    const detalhe = (erro.detalhes || []).map((d) => `${d.field}: ${d.issue}`).join(' · ');
    toast(detalhe ? `${erro.message} (${detalhe})` : erro.message, 'erro');
  }

  // ================= Roteamento =================
  const visoes = ['inicio', 'cardapio', 'pedidos', 'fidelidade', 'painel'];

  function rotaAtual() {
    const nome = (location.hash || '#/inicio').replace('#/', '').split('?')[0];
    return visoes.includes(nome) ? nome : 'inicio';
  }

  async function navegar(_rota, forcar) {
    const rota = rotaAtual();

    document.querySelectorAll('.visao').forEach((v) => v.classList.add('oculto'));
    const visao = $(`#visao-${rota}`);
    visao.classList.remove('oculto');

    document.querySelectorAll('#nav-principal a').forEach((a) => {
      a.classList.toggle('ativo', a.dataset.rota === rota);
    });

    // Guardas de acesso
    if ((rota === 'pedidos' || rota === 'fidelidade' || rota === 'painel') && !estado.usuario) {
      visao.classList.remove('oculto');
      visao.innerHTML = `
        <div class="vazio">
          <span class="icone">🔒</span>
          <p><strong>Entre para continuar</strong></p>
          <p>Esta área precisa de autenticação.</p>
          <p style="margin-top:14px"><button class="btn btn-primario" onclick="abrirModalAuth('entrar')">Entrar</button></p>
        </div>`;
      return;
    }
    if (rota === 'painel' && !ehInterno()) {
      $('#visao-painel').innerHTML = `
        <div class="vazio">
          <span class="icone">🧑‍🍳</span>
          <p><strong>Área da equipe</strong></p>
          <p>Entre com um perfil interno (atendente, cozinha ou gerente).</p>
        </div>`;
      return;
    }

    if (rota === 'inicio') carregarInicio();
    if (rota === 'cardapio') carregarCardapio(forcar);
    if (rota === 'pedidos') carregarPedidos();
    if (rota === 'fidelidade') carregarFidelidade();
    if (rota === 'painel') carregarPainel();
  }

  window.addEventListener('hashchange', () => navegar());

  // ================= Topbar =================
  function atualizarTopbar() {
    const botao = $('#btn-usuario');
    const interno = ehInterno();
    $('#nav-painel').classList.toggle('oculto', !interno);
    $('#nav-painel').style.display = interno ? '' : 'none';

    if (estado.usuario) {
      botao.textContent = estado.usuario.nome.split(' ')[0];
      botao.classList.remove('btn-primario');
      botao.classList.add('btn-fantasma');
    } else {
      botao.textContent = 'Entrar';
      botao.classList.add('btn-primario');
      botao.classList.remove('btn-fantasma');
    }
    atualizarBolhaCarrinho();
  }

  $('#btn-usuario').addEventListener('click', () => {
    if (estado.usuario) {
      if (confirm(`Conectado como ${estado.usuario.nome} (${estado.usuario.perfil}).\n\nDeseja sair da conta?`)) sair();
    } else {
      abrirModalAuth('entrar');
    }
  });

  // ================= Autenticação =================
  function abrirModalAuth(aba) {
    $('#modal-auth').classList.remove('oculto');
    trocarAbaAuth(aba || 'entrar');
  }

  function trocarAbaAuth(aba) {
    document.querySelectorAll('[data-aba-auth]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.abaAuth === aba);
    });
    $('#form-login').classList.toggle('oculto', aba !== 'entrar');
    $('#form-cadastro').classList.toggle('oculto', aba !== 'criar');
  }

  document.querySelectorAll('[data-aba-auth]').forEach((botao) => {
    botao.addEventListener('click', () => trocarAbaAuth(botao.dataset.abaAuth));
  });

  document.querySelectorAll('.chip-demo').forEach((chip) => {
    chip.addEventListener('click', () => {
      trocarAbaAuth('entrar');
      $('#login-email').value = chip.dataset.email;
      $('#login-senha').value = 'Senha@123';
    });
  });

  $('#form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    try {
      const resultado = await api.post('/auth/login', {
        email: $('#login-email').value,
        senha: $('#login-senha').value
      });
      salvarSessao(resultado.user, resultado.accessToken);
      fecharModal('#modal-auth');
      toast(`Bem-vindo(a), ${resultado.user.nome.split(' ')[0]}!`, 'sucesso');
      navegar(null, true);
    } catch (erro) {
      tratarErro(erro);
    }
  });

  $('#form-cadastro').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    try {
      await api.post('/usuarios', {
        nome: $('#cad-nome').value,
        email: $('#cad-email').value,
        senha: $('#cad-senha').value,
        aceitaFidelidade: $('#cad-fidelidade').checked
      });
      const resultado = await api.post('/auth/login', {
        email: $('#cad-email').value,
        senha: $('#cad-senha').value
      });
      salvarSessao(resultado.user, resultado.accessToken);
      fecharModal('#modal-auth');
      toast('Conta criada com sucesso!', 'sucesso');
      navegar(null, true);
    } catch (erro) {
      tratarErro(erro);
    }
  });

  function fecharModal(seletor) {
    $(seletor).classList.add('oculto');
  }

  document.querySelectorAll('.modal-fundo').forEach((fundo) => {
    fundo.addEventListener('click', (evento) => {
      if (evento.target === fundo) fundo.classList.add('oculto');
    });
  });
  $('#btn-fechar-auth').addEventListener('click', () => fecharModal('#modal-auth'));
  $('#btn-fechar-pagamento').addEventListener('click', () => fecharModal('#modal-pagamento'));

  window.abrirModalAuth = abrirModalAuth;

  // ================= Início =================
  async function carregarInicio() {
    try {
      const resultado = await api.get('/unidades?limit=50');
      estado.unidades = resultado.dados;
      $('#grade-unidades').innerHTML = estado.unidades
        .map(
          (u) => `
        <div class="cartao cartao-clicavel cartao-unidade" data-unidade="${u.id}">
          <h3>${u.nome}</h3>
          <p class="cidade">📍 ${u.cidade}</p>
          <div class="rodape-cartao"><span>Unidade aberta</span><span>→</span></div>
        </div>`
        )
        .join('');
      document.querySelectorAll('.cartao-unidade').forEach((cartao) => {
        cartao.addEventListener('click', () => {
          selecionarUnidade(Number(cartao.dataset.unidade));
          location.hash = '#/cardapio';
        });
      });
    } catch (erro) {
      $('#grade-unidades').innerHTML = `<div class="vazio">Não foi possível carregar as unidades: ${erro.message}</div>`;
    }
  }

  // ================= Cardápio =================
  function selecionarUnidade(id) {
    estado.unidadeId = id;
    estado.categoria = '';
    localStorage.setItem('rn_unidade', String(id));
  }

  async function carregarCardapio(forcar) {
    try {
      if (estado.unidades.length === 0 || forcar) {
        const resultado = await api.get('/unidades?limit=50');
        estado.unidades = resultado.dados;
      }
      if (!estado.unidadeId || !estado.unidades.some((u) => u.id === estado.unidadeId)) {
        selecionarUnidade(estado.unidades[0] ? estado.unidades[0].id : null);
      }

      $('#filtro-unidades').innerHTML = estado.unidades
        .map(
          (u) => `
        <button class="chip ${u.id === estado.unidadeId ? 'ativo' : ''}" data-unidade="${u.id}">${u.nome}</button>`
        )
        .join('');
      document.querySelectorAll('#filtro-unidades .chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          selecionarUnidade(Number(chip.dataset.unidade));
          carregarCardapio();
        });
      });

      if (!estado.unidadeId) return;
      const unidade = estado.unidades.find((u) => u.id === estado.unidadeId);
      const resultado = await api.get(`/produtos?unidadeId=${estado.unidadeId}&limit=100`);
      estado.produtos = resultado.dados;

      const categorias = [...new Set(estado.produtos.map((p) => p.categoria || 'Outros'))].sort();
      $('#filtro-categorias').innerHTML =
        `<button class="chip ${estado.categoria === '' ? 'ativo' : ''}" data-cat="">Tudo</button>` +
        categorias
          .map(
            (c) =>
              `<button class="chip ${estado.categoria === c ? 'ativo' : ''}" data-cat="${c}">${c}</button>`
          )
          .join('');
      document.querySelectorAll('#filtro-categorias .chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          estado.categoria = chip.dataset.cat;
          renderizarProdutos(unidade);
        });
      });

      renderizarProdutos(unidade);
    } catch (erro) {
      $('#grade-produtos').innerHTML = `<div class="vazio">Não foi possível carregar o cardápio: ${erro.message}</div>`;
    }
  }

  function renderizarProdutos(unidade) {
    document.querySelectorAll('#filtro-categorias .chip').forEach((chip) => {
      chip.classList.toggle('ativo', chip.dataset.cat === estado.categoria);
    });

    const produtos = estado.produtos.filter(
      (p) => !estado.categoria || (p.categoria || 'Outros') === estado.categoria
    );

    if (produtos.length === 0) {
      $('#grade-produtos').innerHTML = `<div class="vazio"><span class="icone">🧾</span>Nenhum item nesta categoria.</div>`;
      return;
    }

    $('#grade-produtos').innerHTML = produtos
      .map((p) => {
        const zerado = p.quantidadeDisponivel <= 0;
        return `
      <div class="cartao cartao-produto ${zerado ? 'indisponivel' : ''}">
        <span class="categoria">${p.categoria || 'Outros'}</span>
        <h3>${p.nome}</h3>
        <p class="descricao">${p.descricao || ''}</p>
        <div class="linha-preco">
          <span class="preco">${brl(p.precoUnitario)}</span>
          <button class="btn btn-primario btn-mini" data-add="${p.id}" ${zerado ? 'disabled' : ''}>
            ${zerado ? 'Esgotado' : 'Adicionar'}
          </button>
        </div>
        <span class="saldo-estoque ${zerado ? 'zerado' : ''}">
          ${zerado ? 'Indisponível nesta unidade' : `${p.quantidadeDisponivel} disponível(is) · ${unidade ? unidade.nome : ''}`}
        </span>
      </div>`;
      })
      .join('');

    document.querySelectorAll('[data-add]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const produto = estado.produtos.find((p) => p.id === Number(botao.dataset.add));
        adicionarAoCarrinho(produto);
      });
    });
  }

  // ================= Carrinho =================
  function adicionarAoCarrinho(produto) {
    if (!produto || produto.quantidadeDisponivel <= 0) return;
    if (!estado.usuario) {
      toast('Entre para montar seu pedido.', 'erro');
      abrirModalAuth('entrar');
      return;
    }
    if (estado.usuario.perfil !== 'CLIENTE' && estado.usuario.perfil !== 'ATENDENTE') {
      toast('Apenas CLIENTE ou ATENDENTE podem criar pedidos.', 'erro');
      return;
    }

    const item = estado.carrinho.find((i) => i.produtoId === produto.id);
    const noCarrinho = item ? item.quantidade : 0;
    if (noCarrinho + 1 > produto.quantidadeDisponivel) {
      toast(`Estoque da unidade: ${produto.quantidadeDisponivel} unidade(s).`, 'erro');
      return;
    }
    if (item) item.quantidade += 1;
    else
      estado.carrinho.push({
        produtoId: produto.id,
        nome: produto.nome,
        precoUnitario: produto.precoUnitario,
        quantidade: 1,
        max: produto.quantidadeDisponivel
      });

    persistirCarrinho();
    toast(`${produto.nome} adicionado.`, 'sucesso');
    abrirCarrinho();
  }

  function persistirCarrinho() {
    localStorage.setItem('rn_carrinho', JSON.stringify(estado.carrinho));
    atualizarBolhaCarrinho();
  }

  function atualizarBolhaCarrinho() {
    const total = estado.carrinho.reduce((s, i) => s + i.quantidade, 0);
    $('#carrinho-bolha').textContent = String(total);
    $('#carrinho-bolha').classList.toggle('oculto', total === 0);
  }

  function abrirCarrinho() {
    renderizarCarrinho();
    $('#fundo-gaveta').classList.remove('oculto');
    $('#gaveta-carrinho').classList.remove('oculto');
  }

  function fecharCarrinho() {
    $('#fundo-gaveta').classList.add('oculto');
    $('#gaveta-carrinho').classList.add('oculto');
  }

  $('#btn-carrinho').addEventListener('click', abrirCarrinho);
  $('#btn-fechar-carrinho').addEventListener('click', fecharCarrinho);
  $('#fundo-gaveta').addEventListener('click', fecharCarrinho);

  function renderizarCarrinho(resumoPedido) {
    const conteudo = $('#carrinho-conteudo');

    if (resumoPedido) {
      conteudo.innerHTML = `
        <div class="resultado-pagamento aprovado">
          <span class="icone-grande">🧾</span>
          <h3>Pedido #${resumoPedido.pedidoId} criado!</h3>
          <p class="detalhe">
            Canal ${rotulosCanal[resumoPedido.canalPedido] || resumoPedido.canalPedido} ·
            Total <strong>${brl(resumoPedido.total)}</strong><br>
            Status: aguardando pagamento.
          </p>
          <button class="btn btn-primario btn-bloco" id="btn-pagar-agora">Pagar agora</button>
          <button class="btn btn-fantasma btn-bloco" id="btn-ver-pedidos">Ver meus pedidos</button>
        </div>`;
      $('#btn-pagar-agora').addEventListener('click', () => {
        fecharCarrinho();
        abrirModalPagamento(resumoPedido);
      });
      $('#btn-ver-pedidos').addEventListener('click', () => {
        fecharCarrinho();
        location.hash = '#/pedidos';
      });
      return;
    }

    if (estado.carrinho.length === 0) {
      conteudo.innerHTML = `
        <div class="vazio">
          <span class="icone">🛒</span>
          <p><strong>Seu carrinho está vazio</strong></p>
          <p>Escolha itens no cardápio para começar.</p>
          <p style="margin-top:12px"><a class="btn btn-primario" href="#/cardapio" onclick="fecharCarrinhoUI()">Ir ao cardápio</a></p>
        </div>`;
      return;
    }

    const unidade = estado.unidades.find((u) => u.id === estado.unidadeId);
    const total = estado.carrinho.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);

    conteudo.innerHTML = `
      ${unidade ? `<p class="meta" style="color:var(--tinta-suave);font-size:.9rem">Retirada/entrega pela unidade <strong>${unidade.nome}</strong>.</p>` : ''}
      ${estado.carrinho
        .map(
          (i) => `
        <div class="item-carrinho">
          <span class="nome">${i.nome}</span>
          <span class="preco-item">${brl(i.precoUnitario * i.quantidade)}</span>
          <div class="controle">
            <button data-menos="${i.produtoId}" aria-label="Diminuir">−</button>
            <strong>${i.quantidade}</strong>
            <button data-mais="${i.produtoId}" aria-label="Aumentar">+</button>
          </div>
          <button class="remover" data-remover="${i.produtoId}">remover</button>
        </div>`
        )
        .join('')}

      <div class="campo">
        <label for="carrinho-canal">Canal do pedido</label>
        <select id="carrinho-canal">
          ${CANAIS.map((c) => `<option value="${c}">${rotulosCanal[c]}</option>`).join('')}
        </select>
      </div>

      <div class="resumo-carrinho">
        <div class="linha total"><span>Total</span><span>${brl(total)}</span></div>
        <button class="btn btn-primario btn-bloco" id="btn-finalizar">Finalizar pedido</button>
        <button class="btn btn-fantasma btn-bloco" id="btn-limpar">Limpar carrinho</button>
      </div>`;

    document.querySelectorAll('[data-mais]').forEach((b) =>
      b.addEventListener('click', () => {
        const item = estado.carrinho.find((i) => i.produtoId === Number(b.dataset.mais));
        if (item.quantidade + 1 > item.max) {
          toast(`Máximo em estoque: ${item.max}.`, 'erro');
          return;
        }
        item.quantidade += 1;
        persistirCarrinho();
        renderizarCarrinho();
      })
    );
    document.querySelectorAll('[data-menos]').forEach((b) =>
      b.addEventListener('click', () => {
        const item = estado.carrinho.find((i) => i.produtoId === Number(b.dataset.menos));
        item.quantidade -= 1;
        if (item.quantidade <= 0) estado.carrinho = estado.carrinho.filter((i) => i !== item);
        persistirCarrinho();
        renderizarCarrinho();
      })
    );
    document.querySelectorAll('[data-remover]').forEach((b) =>
      b.addEventListener('click', () => {
        estado.carrinho = estado.carrinho.filter((i) => i.produtoId !== Number(b.dataset.remover));
        persistirCarrinho();
        renderizarCarrinho();
      })
    );
    $('#btn-limpar').addEventListener('click', () => {
      estado.carrinho = [];
      persistirCarrinho();
      renderizarCarrinho();
    });
    $('#btn-finalizar').addEventListener('click', finalizarPedido);
  }

  window.fecharCarrinhoUI = fecharCarrinho;

  async function finalizarPedido() {
    if (estado.carrinho.length === 0) return;
    const canalPedido = $('#carrinho-canal').value;
    try {
      const pedido = await api.post('/pedidos', {
        unidadeId: estado.unidadeId,
        canalPedido,
        itens: estado.carrinho.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade }))
      });
      estado.carrinho = [];
      persistirCarrinho();
      renderizarCarrinho(pedido);
      toast('Pedido criado com sucesso!', 'sucesso');
    } catch (erro) {
      tratarErro(erro);
    }
  }

  // ================= Pagamento (mock) =================
  function abrirModalPagamento(pedido) {
    $('#pagamento-conteudo').innerHTML = `
      <h2 style="margin-bottom:6px">Pagar pedido #${pedido.pedidoId}</h2>
      <p style="color:var(--tinta-suave);font-size:.92rem;margin-bottom:16px">
        Total <strong>${brl(pedido.total)}</strong> — pagamento simulado (gateway mock).
      </p>
      <div class="campo">
        <label for="forma-pagamento">Forma de pagamento</label>
        <select id="forma-pagamento">
          <option value="PIX">Pix</option>
          <option value="CARTAO">Cartão</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="CARTAO_RECUSADO">Cartão (teste de recusa)</option>
        </select>
      </div>
      <button class="btn btn-primario btn-bloco" id="btn-confirmar-pagamento">Confirmar pagamento</button>
      <p style="font-size:.8rem;color:var(--tinta-suave);margin-top:10px">
        “Cartão (teste de recusa)” é um gatilho de demonstração do cenário de falha.
      </p>`;
    $('#modal-pagamento').classList.remove('oculto');

    $('#btn-confirmar-pagamento').addEventListener('click', async () => {
      const formaPagamento = $('#forma-pagamento').value;
      const botao = $('#btn-confirmar-pagamento');
      botao.disabled = true;
      botao.textContent = 'Processando…';
      try {
        const resultado = await api.post('/pagamentos', {
          pedidoId: pedido.pedidoId,
          formaPagamento
        });
        const aprovado = resultado.pagamento && resultado.pagamento.status === 'APROVADO';
        $('#pagamento-conteudo').innerHTML = aprovado
          ? `
          <div class="resultado-pagamento aprovado">
            <span class="icone-grande">✅</span>
            <h3>Pagamento aprovado!</h3>
            <p class="detalhe">
              Pedido #${resultado.pedido.pedidoId} agora está <strong>em preparo</strong>.<br>
              ${resultado.fidelidade && resultado.fidelidade.pontosAcumulados
                ? `Você acumulou <strong>${resultado.fidelidade.pontosAcumulados} ponto(s)</strong> na fidelidade. 🎉`
                : ''}
            </p>
            <a class="btn btn-primario btn-bloco" href="#/pedidos" onclick="document.getElementById('modal-pagamento').classList.add('oculto')">Acompanhar pedido</a>
          </div>`
          : `
          <div class="resultado-pagamento recusado">
            <span class="icone-grande">❌</span>
            <h3>Pagamento recusado</h3>
            <p class="detalhe">${resultado.pagamento ? resultado.pagamento.mensagem : 'O gateway não aprovou o pagamento.'}<br>
            O pedido continua aguardando pagamento — tente outra forma.</p>
            <button class="btn btn-fantasma btn-bloco" onclick="document.getElementById('modal-pagamento').classList.add('oculto')">Fechar</button>
          </div>`;
        if (aprovado) toast('Pagamento aprovado!', 'sucesso');
      } catch (erro) {
        tratarErro(erro);
        botao.disabled = false;
        botao.textContent = 'Confirmar pagamento';
      }
    });
  }

  // ================= Pedidos =================
  async function carregarPedidos() {
    const interno = ehInterno();
    $('#pedidos-filtros').classList.toggle('oculto', !interno);
    $('#pedidos-subtitulo').textContent = interno
      ? 'Todos os pedidos da rede — filtre por canal e status.'
      : 'Acompanhe o status dos seus pedidos.';

    const canal = $('#filtro-canal').value || '';
    const status = $('#filtro-status').value || '';
    const query = new URLSearchParams();
    if (canal) query.set('canalPedido', canal);
    if (status) query.set('status', status);
    query.set('limit', '50');

    const lista = $('#lista-pedidos');
    lista.innerHTML = '<div class="skeleton" style="height:140px"></div><div class="skeleton" style="height:140px"></div>';

    try {
      if (Object.keys(estado.nomesProdutos).length === 0) {
        const catalogo = await api.get('/produtos?limit=100');
        estado.nomesProdutos = Object.fromEntries(catalogo.dados.map((p) => [p.id, p.nome]));
      }
      const resultado = await api.get(`/pedidos?${query.toString()}`);
      if (resultado.dados.length === 0) {
        lista.innerHTML = `
          <div class="vazio">
            <span class="icone">📭</span>
            <p><strong>Nenhum pedido encontrado</strong></p>
            ${interno ? '' : '<p>Faça seu primeiro pedido no cardápio!</p>'}
          </div>`;
        return;
      }
      lista.innerHTML = resultado.dados.map(renderizarCartaoPedido).join('');
      ligarAcoesPedidos();
    } catch (erro) {
      tratarErro(erro);
      lista.innerHTML = `<div class="vazio">Não foi possível carregar os pedidos.</div>`;
    }
  }

  $('#filtro-canal').addEventListener('change', carregarPedidos);
  $('#filtro-status').addEventListener('change', carregarPedidos);

  function renderizarCartaoPedido(pedido) {
    const podePagar =
      pedido.status === 'AGUARDANDO_PAGAMENTO' &&
      estado.usuario &&
      (estado.usuario.perfil !== 'CLIENTE' ||
        (pedido.cliente && pedido.cliente.id === estado.usuario.id));
    const podeCancelar = podePagar;
    const podePronto =
      pedido.status === 'EM_PREPARO' &&
      estado.usuario &&
      (estado.usuario.perfil === 'COZINHA' || estado.usuario.perfil === 'GERENTE');
    const podeEntregar =
      pedido.status === 'PRONTO' &&
      estado.usuario &&
      (estado.usuario.perfil === 'ATENDENTE' || estado.usuario.perfil === 'GERENTE');

    const acoes = [];
    if (podePagar)
      acoes.push(
        `<button class="btn btn-primario btn-mini" data-pagar="${pedido.pedidoId}">Pagar</button>`
      );
    if (podePronto)
      acoes.push(
        `<button class="btn btn-primario btn-mini" data-status="PRONTO" data-id="${pedido.pedidoId}">Marcar pronto</button>`
      );
    if (podeEntregar)
      acoes.push(
        `<button class="btn btn-primario btn-mini" data-status="ENTREGUE" data-id="${pedido.pedidoId}">Marcar entregue</button>`
      );
    if (podeCancelar)
      acoes.push(
        `<button class="btn btn-perigo btn-mini" data-status="CANCELADO" data-id="${pedido.pedidoId}">Cancelar</button>`
      );

    return `
    <div class="cartao cartao-pedido">
      <div class="linha-topo">
        <span class="numero">Pedido #${pedido.pedidoId}</span>
        <span class="selos">
          <span class="selo selo-canal">${rotulosCanal[pedido.canalPedido] || pedido.canalPedido}</span>
          <span class="selo ${classeStatus[pedido.status] || ''}">${rotulosStatus[pedido.status] || pedido.status}</span>
        </span>
      </div>
      <p class="meta">
        ${pedido.unidade ? pedido.unidade.nome : ''} · ${dataHora(pedido.criadoEm)}
        ${pedido.cliente ? ` · Cliente: ${pedido.cliente.nome}` : ''}
      </p>
      <div class="itens">
        ${pedido.itens
          .map(
            (i) =>
              `<div><span>${i.quantidade}× ${estado.nomesProdutos[i.produtoId] || 'Produto ' + i.produtoId}</span><span>${brl(i.precoUnitario * i.quantidade)}</span></div>`
          )
          .join('')}
      </div>
      <div class="linha-total">
        <span class="preco">Total: ${brl(pedido.total)}</span>
        <span class="acoes">${acoes.join('')}</span>
      </div>
    </div>`;
  }

  function ligarAcoesPedidos() {
    document.querySelectorAll('[data-pagar]').forEach((botao) => {
      botao.addEventListener('click', async () => {
        const id = Number(botao.dataset.pagar);
        try {
          const resultado = await api.get(`/pedidos?limit=50`);
          const pedido = resultado.dados.find((p) => p.pedidoId === id);
          if (pedido) abrirModalPagamento(pedido);
        } catch (erro) {
          tratarErro(erro);
        }
      });
    });
    document.querySelectorAll('[data-status]').forEach((botao) => {
      botao.addEventListener('click', async () => {
        const id = Number(botao.dataset.id);
        const novo = botao.dataset.status;
        if (novo === 'CANCELADO' && !confirm(`Cancelar o pedido #${id}? Os itens voltam ao estoque.`)) return;
        try {
          await api.patch(`/pedidos/${id}/status`, { status: novo });
          toast(`Pedido #${id}: ${rotulosStatus[novo]}.`, 'sucesso');
          carregarPedidos();
        } catch (erro) {
          tratarErro(erro);
        }
      });
    });
  }

  // ================= Fidelidade =================
  async function carregarFidelidade() {
    const conteudo = $('#fidelidade-conteudo');
    conteudo.innerHTML = '<div class="skeleton" style="height:160px"></div>';
    try {
      if (estado.usuario.perfil !== 'CLIENTE') {
        conteudo.innerHTML = `
          <div class="vazio">
            <span class="icone">🎯</span>
            <p><strong>Programa para clientes</strong></p>
            <p>Seu perfil (${estado.usuario.perfil}) não acumula pontos — entre com uma conta de cliente.</p>
          </div>`;
        return;
      }

      const saldo = await api.get('/fidelidade/saldo');
      const lancamentos = await api.get('/fidelidade/lancamentos?limit=20');

      const podeResgatar = saldo.consentimentoFidelidade && saldo.saldoPontos >= 100;
      conteudo.innerHTML = `
      <div class="painel-saldo">
        <div class="cartao-saldo">
          <p class="rotulo">Saldo de pontos</p>
          <p class="saldo">${saldo.saldoPontos}</p>
          <p class="nota">
            ${saldo.consentimentoFidelidade
              ? 'Consentimento ativo — você acumula 1 ponto a cada R$ 10.'
              : 'Sem consentimento do programa — entre em contato com a loja.'}
          </p>
        </div>
        <div class="cartao cartao-resgate">
          <h3>Resgatar desconto</h3>
          <p style="color:var(--tinta-suave);font-size:.92rem">100 pontos = R$ 10 de desconto. Resgates em múltiplos de 100.</p>
          <div class="opcoes">
            ${[100, 200, 300]
              .map(
                (pontos) => `
              <button class="btn btn-fantasma" data-resgatar="${pontos}" ${podeResgatar && saldo.saldoPontos >= pontos ? '' : 'disabled'}>
                ${pontos} pts → ${brl(pontos / 10)}
              </button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <h3 style="margin-bottom:10px">Extrato</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Pontos</th><th>Descrição</th></tr>
          </thead>
          <tbody>
            ${lancamentos.dados
              .map(
                (l) => `
              <tr>
                <td>${dataHora(l.dataHora)}</td>
                <td>${l.tipo === 'ACUMULO' ? 'Acúmulo' : 'Resgate'}</td>
                <td class="${l.tipo === 'ACUMULO' ? 'pontos-mais' : 'pontos-menos'}">
                  ${l.tipo === 'ACUMULO' ? '+' : '−'}${l.pontos}
                </td>
                <td>${l.descricao || l.motivo || '—'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

      document.querySelectorAll('[data-resgatar]').forEach((botao) => {
        botao.addEventListener('click', async () => {
          const pontos = Number(botao.dataset.resgatar);
          try {
            const resultado = await api.post('/fidelidade/resgates', { pontos });
            toast(`Resgate ok: ${resultado.cupomDesconto} de desconto.`, 'sucesso');
            carregarFidelidade();
          } catch (erro) {
            tratarErro(erro);
          }
        });
      });
    } catch (erro) {
      tratarErro(erro);
      conteudo.innerHTML = `<div class="vazio">Não foi possível carregar a fidelidade.</div>`;
    }
  }

  // ================= Painel interno =================
  document.querySelectorAll('#painel-abas .aba').forEach((botao) => {
    botao.addEventListener('click', () => {
      estado.abaPainel = botao.dataset.aba;
      document.querySelectorAll('#painel-abas .aba').forEach((b) => b.classList.toggle('ativa', b === botao));
      carregarPainel();
    });
  });

  async function carregarPainel() {
    if (estado.unidades.length === 0) {
      try {
        const resultado = await api.get('/unidades?limit=50');
        estado.unidades = resultado.dados;
      } catch (erro) {
        tratarErro(erro);
        return;
      }
    }
    const conteudo = $('#painel-conteudo');
    if (estado.abaPainel === 'estoque') await painelEstoque(conteudo);
    if (estado.abaPainel === 'produtos') await painelProdutos(conteudo);
    if (estado.abaPainel === 'auditoria') await painelAuditoria(conteudo);
  }

  async function painelEstoque(conteudo) {
    const ehOperacional = ['ATENDENTE', 'GERENTE'].includes(estado.usuario.perfil);
    const unidadeId = estado.unidadeId || estado.unidades[0].id;
    conteudo.innerHTML = '<div class="skeleton" style="height:220px"></div>';
    try {
      const resultado = await api.get(`/estoque/${unidadeId}`);
      const itens = resultado.itens;

      conteudo.innerHTML = `
      <div class="painel-linha">
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th><th>Situação</th></tr></thead>
            <tbody>
              ${itens
                .map(
                  (i) => `
                <tr>
                  <td>${i.produto}</td>
                  <td><strong>${i.quantidade}</strong></td>
                  <td>${i.minimo}</td>
                  <td>${i.abaixoDoMinimo ? '<span class="selo selo-cancelado">Abaixo do mínimo</span>' : '<span class="selo selo-pronto">OK</span>'}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        ${
          ehOperacional
            ? `
        <div class="cartao">
          <h3 style="margin-bottom:10px">Movimentar estoque</h3>
          <div class="form-linha">
            <div class="campo">
              <label for="mov-produto">Produto</label>
              <select id="mov-produto">
                ${itens.map((i) => `<option value="${i.produtoId}">${i.produto}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label for="mov-tipo">Tipo</label>
              <select id="mov-tipo">
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </select>
            </div>
            <div class="campo">
              <label for="mov-quantidade">Quantidade</label>
              <input type="number" id="mov-quantidade" min="1" value="10" required>
            </div>
            <button class="btn btn-primario btn-bloco" id="btn-movimentar">Registrar movimento</button>
          </div>
        </div>`
            : '<div class="vazio">Somente ATENDENTE ou GERENTE movimentam o estoque.</div>'
        }
      </div>`;

      if (ehOperacional) {
        $('#btn-movimentar').addEventListener('click', async () => {
          try {
            const resposta = await api.post('/estoque/movimentos', {
              unidadeId,
              produtoId: Number($('#mov-produto').value),
              tipo: $('#mov-tipo').value,
              quantidade: Number($('#mov-quantidade').value)
            });
            toast(`Movimento ok — saldo atual: ${resposta.saldoAtual}.`, 'sucesso');
            painelEstoque(conteudo);
          } catch (erro) {
            tratarErro(erro);
          }
        });
      }
    } catch (erro) {
      tratarErro(erro);
      conteudo.innerHTML = `<div class="vazio">Não foi possível carregar o estoque.</div>`;
    }
  }

  async function painelProdutos(conteudo) {
    if (estado.usuario.perfil !== 'GERENTE') {
      conteudo.innerHTML = `<div class="vazio">Somente o GERENTE administra produtos.</div>`;
      return;
    }
    conteudo.innerHTML = '<div class="skeleton" style="height:220px"></div>';
    try {
      const resultado = await api.get('/produtos?limit=100');
      const produtos = resultado.dados;

      conteudo.innerHTML = `
      <div class="painel-linha">
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              ${produtos
                .map(
                  (p) => `
                <tr>
                  <td>${p.nome}</td>
                  <td>${p.categoria || '—'}</td>
                  <td>${brl(p.precoUnitario)}</td>
                  <td>${p.disponivel ? '<span class="selo selo-pronto">Disponível</span>' : '<span class="selo selo-cancelado">Indisponível</span>'}</td>
                  <td>
                    <button class="btn btn-fantasma btn-mini" data-alternar="${p.id}" data-disponivel="${p.disponivel}">
                      ${p.disponivel ? 'Indisponibilizar' : 'Disponibilizar'}
                    </button>
                    <button class="btn btn-perigo btn-mini" data-excluir="${p.id}">Excluir</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="cartao">
          <h3 style="margin-bottom:10px">Novo produto</h3>
          <div class="form-linha">
            <div class="campo"><label for="prod-nome">Nome</label><input id="prod-nome" required placeholder="Ex.: Mungunzá salgado"></div>
            <div class="campo"><label for="prod-categoria">Categoria</label><input id="prod-categoria" required placeholder="Ex.: Caldos"></div>
            <div class="campo"><label for="prod-preco">Preço (R$)</label><input type="number" id="prod-preco" min="0.01" step="0.01" required placeholder="14.90"></div>
            <div class="campo"><label for="prod-descricao">Descrição</label><input id="prod-descricao" placeholder="Opcional"></div>
            <button class="btn btn-primario btn-bloco" id="btn-criar-produto">Criar produto</button>
          </div>
        </div>
      </div>`;

      document.querySelectorAll('[data-alternar]').forEach((botao) => {
        botao.addEventListener('click', async () => {
          const id = Number(botao.dataset.alternar);
          try {
            await api.put(`/produtos/${id}`, { disponivel: botao.dataset.disponivel !== 'true' });
            toast('Produto atualizado.', 'sucesso');
            painelProdutos(conteudo);
          } catch (erro) {
            tratarErro(erro);
          }
        });
      });
      document.querySelectorAll('[data-excluir]').forEach((botao) => {
        botao.addEventListener('click', async () => {
          if (!confirm('Excluir este produto? Produtos que já aparecem em pedidos não podem ser excluídos.')) return;
          try {
            await api.del(`/produtos/${Number(botao.dataset.excluir)}`);
            toast('Produto excluído.', 'sucesso');
            painelProdutos(conteudo);
          } catch (erro) {
            tratarErro(erro);
          }
        });
      });
      $('#btn-criar-produto').addEventListener('click', async () => {
        try {
          await api.post('/produtos', {
            nome: $('#prod-nome').value,
            categoria: $('#prod-categoria').value,
            precoUnitario: Number($('#prod-preco').value),
            descricao: $('#prod-descricao').value || undefined
          });
          toast('Produto criado!', 'sucesso');
          painelProdutos(conteudo);
        } catch (erro) {
          tratarErro(erro);
        }
      });
    } catch (erro) {
      tratarErro(erro);
      conteudo.innerHTML = `<div class="vazio">Não foi possível carregar os produtos.</div>`;
    }
  }

  async function painelAuditoria(conteudo) {
    if (estado.usuario.perfil !== 'GERENTE') {
      conteudo.innerHTML = `<div class="vazio">Auditoria visível apenas para GERENTE.</div>`;
      return;
    }
    conteudo.innerHTML = '<div class="skeleton" style="height:220px"></div>';
    try {
      const resultado = await api.get('/logs?limit=50');
      conteudo.innerHTML = `
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Detalhe</th></tr></thead>
          <tbody>
            ${resultado.dados
              .map(
                (l) => `
              <tr>
                <td>${dataHora(l.dataHora)}</td>
                <td><strong>${l.acao}</strong></td>
                <td>${l.entidade} #${l.entidadeId}</td>
                <td>${l.detalhe || '—'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    } catch (erro) {
      tratarErro(erro);
      conteudo.innerHTML = `<div class="vazio">Não foi possível carregar os logs.</div>`;
    }
  }

  // ================= Inicialização =================
  atualizarTopbar();
  navegar(null, true);
})();
