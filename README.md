# API Raízes do Nordeste

API back-end para a rede de lanchonetes nordestinas **Raízes do Nordeste**: pedidos multicanal (App, Totem, Balcão, Pickup, Web), cardápio e estoque por unidade, fidelização com consentimento LGPD e pagamento simulado (mock).

Projeto da disciplina **Projeto Multidisciplinar (trilha Back-end)**, desenvolvido como projeto pessoal de estudo e portfólio. Stack 100% gratuita — a API roda localmente, sem nenhum serviço pago.

| Função | Ferramenta |
|---|---|
| Runtime | Node.js 22/24 (LTS) |
| Framework HTTP | Express 4 |
| ORM e migrations | Prisma 6 |
| Banco de dados | SQLite (arquivo local, sem servidor) |
| Segurança | bcryptjs (hash de senha) + jsonwebtoken (JWT com perfis) |
| Documentação | Swagger UI servindo OpenAPI 3.0 (YAML) |
| Testes | Coleção Postman (executável com Newman) |

## Funcionalidades

- **Interface web integrada** — página única servida pela própria API para usar o sistema de ponta a ponta: cardápio por unidade, carrinho, pedido em cinco canais, pagamento simulado, acompanhamento de status, fidelidade e painel interno (estoque, produtos e auditoria)
- **Autenticação JWT com perfis** — CLIENTE, ATENDENTE, COZINHA e GERENTE, autorização declarada rota a rota
- **Cadastro público de cliente** com registro de consentimento LGPD (data + versão do termo)
- **Cardápio por unidade** com saldo disponível em estoque
- **CRUD administrativo de produtos** (GERENTE)
- **Estoque por unidade** com movimentações rastreáveis (quem movimentou, quando, entrada ou saída)
- **Pedidos com `canalPedido` obrigatório** (APP, TOTEM, BALCAO, PICKUP, WEB), filtrável na consulta
- **Fluxo crítico fechado:** criar pedido (valida estoque, calcula total no servidor, congela preços, baixa estoque em transação) → **pagamento mock** (aprova/recusa, registra tentativa) → **atualização de status** (EM_PREPARO → PRONTO → ENTREGUE; cancelamento devolve estoque)
- **Fidelidade:** 1 ponto a cada R$ 10 no pagamento aprovado; resgate em múltiplos de 100 (100 pontos = R$ 10); só para quem consentiu
- **Logs de auditoria** de ações sensíveis (pedido, status, estoque, pagamento, resgate e acesso a dados pessoais), consultáveis por GERENTE
- **Erro padronizado** em JSON: `{ error, message, details, timestamp, path }`
- **Documentação interativa** (Swagger) refletindo o contrato real, com exemplos de request/response

## Como executar

Pré-requisitos: **Node.js 18+** (testado em 22/24) e npm. Não há banco para instalar — o SQLite é um arquivo local.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# (edite o JWT_SECRET se quiser; os valores de exemplo funcionam localmente)

# 3. Criar o banco e aplicar a migration
npx prisma migrate dev

# 4. Popular dados de teste (unidades, produtos, estoque, usuários)
npm run seed

# 5. Iniciar a API
npm start
```

A API sobe em **http://localhost:3000** (healthcheck: `GET /status`).

### Interface web

A página do sistema é servida pela própria API na mesma origem: **http://localhost:3000**

- **Cardápio** — escolha a unidade e veja os itens com o saldo real de estoque de cada loja
- **Carrinho** — monte o pedido, escolha o canal (App, Totem, Balcão, Pickup, Web) e finalize
- **Pagamento simulado** — Pix, cartão ou dinheiro; a opção "Cartão (teste de recusa)" demonstra o cenário de falha
- **Pedidos** — acompanhe o status (em preparo → pronto → entregue), cancele ou pague o que estiver pendente
- **Fidelidade** — saldo de pontos, extrato e resgate (100 pontos = R$ 10)
- **Painel interno** — perfis da equipe veem estoque com movimentação; o gerente administra produtos e consulta a auditoria

Use as contas de demonstração listadas abaixo (botões de atalho na própria tela de login).

### Documentação (Swagger)

Com a API rodando, acesse: **http://localhost:3000/api-docs**

### Credenciais do seed (senha padrão `Senha@123`)

| Perfil | E-mail | Observação |
|---|---|---|
| GERENTE | gerente@raizes.com | acesso total |
| COZINHA | cozinha@raizes.com | avança EM_PREPARO → PRONTO |
| ATENDENTE | atendente@raizes.com | pedidos de balcão, entregas e estoque |
| CLIENTE | cliente@raizes.com | **com consentimento** de fidelidade (saldo inicial 350 pts) |
| CLIENTE | cliente2@raizes.com | **sem consentimento** (usado no cenário de erro) |

Dados iniciais: 3 unidades (Recife Boa Viagem — matriz, Recife Centro, Caruaru), 10 produtos com estoque por unidade. O produto 10 (Caldo de carne) está **zerado em Caruaru** de propósito — é o cenário de venda por indisponibilidade.

### Como rodar os testes

A coleção Postman cobre **24 cenários (T01–T24)** — positivos e negativos — organizados em pastas: logins por perfil, auth, usuários, produtos, estoque, pedidos, pagamentos, status, fidelidade, auditoria e erros. Execução automática com Newman:

```bash
# banco limpo garante os saldos esperados pelos testes
npx prisma migrate reset --force

npm start            # em um terminal
npx newman run postman/raizes-nordeste.postman_collection.json   # em outro
```

Resultado esperado: **29 requisições / 39 assertions / 0 falhas**. No Postman/Insomnia, importe `postman/raizes-nordeste.postman_collection.json` e execute as pastas em ordem (a pasta *Setup* guarda os tokens usados pelas demais).

## Endpoints principais

| Recurso | Rota | Acesso |
|---|---|---|
| Auth | `POST /auth/login` | público |
| Usuários | `POST /usuarios` · `GET /usuarios/{id}` | público · próprio ou GERENTE |
| Unidades | `GET /unidades` | público |
| Produtos | `GET /produtos?unidadeId=` · `POST/PUT/DELETE /produtos` | público · GERENTE |
| Estoque | `GET /estoque/{unidadeId}` · `POST /estoque/movimentos` | perfis operacionais · ATENDENTE/GERENTE |
| Pedidos | `POST /pedidos` · `GET /pedidos?canalPedido=&status=` · `PATCH /pedidos/{id}/status` | CLIENTE/ATENDENTE · autenticados · por transição |
| Pagamentos | `POST /pagamentos` · `GET /pagamentos/{id}` | CLIENTE/ATENDENTE · envolvidos |
| Fidelidade | `GET /fidelidade/saldo` · `GET /fidelidade/lancamentos` · `POST /fidelidade/resgates` | CLIENTE |
| Auditoria | `GET /logs?entidade=&entidadeId=` | GERENTE |
| Interface | `GET /` (página única do sistema) | pública |

Todas as listagens são paginadas (`?page=1&limit=10`, máximo 100). O contrato completo, com exemplos e códigos de status, está no Swagger.

## Deploy na Vercel (gratuito)

O projeto está pronto para deploy sem nenhuma configuração manual de banco ou variáveis de ambiente:

1. Acesse [vercel.com/new](https://vercel.com/new) e importe este repositório (conta gratuita, Hobby plan);
2. Confirme as opções detectadas — o `vercel.json` cuida do resto;
3. Clique em **Deploy**.

O que acontece no deploy:

- O build aplica as migrations e roda o seed, criando o SQLite dentro do ambiente;
- A API, a interface web e o Swagger são servidos pelo mesmo endereço (a função serverless em `api/index.js` reusa `src/app.js`);
- O `JWT_SECRET` tem um valor padrão de demonstração — em produção, defina a variável no painel da Vercel (Settings → Environment Variables);
- **Limitação da demonstração:** no plano serverless, cada novo container recomeça com os dados do seed (pedidos e movimentos feitos durante a sessão são voláteis). Para uso real, troque o SQLite por um banco gerenciado (ex.: Neon/Supabase PostgreSQL — há planos gratuitos) ajustando o `provider` no `schema.prisma`.


## Regras de negócio essenciais

- `canalPedido` é **obrigatório** na criação e validado contra os cinco valores; ausente ou inválido → 422
- Total calculado **no servidor**; preços congelados nos itens no momento do pedido
- Pedido com produto inexistente → 404; com estoque insuficiente ou produto indisponível → 409 (detalhe traz o "Disponível: N")
- Transições de status: pagamento aprovado → EM_PREPARO; COZINHA/GERENTE → PRONTO; ATENDENTE/GERENTE → ENTREGUE; CANCELADO só antes da preparação (devolve estoque); tentativa inválida → 409
- O mock aprova qualquer forma de pagamento válida, **exceto `CARTAO_RECUSADO`** — gatilho determinístico do cenário de recusa; pedido recusado permanece AGUARDANDO_PAGAMENTO
- Pontos só acumulam com consentimento LGPD registrado; sem consentimento → conta nem existe (resgate → 409 `FIDELIDADE_SEM_CONSENTIMENTO`)

## Estrutura do projeto (arquitetura em camadas)

```text
src/
├── server.js                  # ponto de entrada
├── app.js                     # Express, Swagger e middlewares globais
├── api/                       # camada API: rotas e middlewares (auth JWT, erro padrão)
├── application/               # camada Application: casos de uso (pedidos, pagamento, fidelidade…)
├── domain/                    # camada Domain: validações, enumerações e erros de negócio
└── infrastructure/            # camada Infrastructure: Prisma e gateway de pagamento mock
docs/                          # requisitos, casos de uso, DER, classes, arquitetura, LGPD, OpenAPI
prisma/                        # schema, migrations e seed
postman/                       # coleção de testes (T01–T24)
public/                        # interface web (HTML, CSS e JS servidos pela API)
api/                           # entrada serverless para o deploy na Vercel
```

Detalhes em `docs/arquitetura.md`.

## Segurança e LGPD

Senha armazenada só como hash bcrypt; JWT assinado com expiração (8h padrão); perfis verificados por middleware em cada rota; `senhaHash` nunca sai nas respostas; consulta de dados pessoais por terceiros gera log de auditoria; consentimento de fidelidade registrado com data e versão do termo. Declaração completa (dados coletados, finalidade, base legal, retenção e anonimização) em `docs/lgpd.md`.

## O que fica fora do MVP (evolução documentada)

Promoções/campanhas implementadas (regra de como aplicar está em `docs/requisitos.md` — RF14); refresh token e revogação de sessão; relatórios consolidados para a matriz; integração real com gateway de pagamento; exclusão/anonimização de conta automatizada. Prioridade dada à profundidade do fluxo crítico, não à quantidade de rotas.

## Referências

- [Documentação do Express](https://expressjs.com/)
- [Documentação do Prisma ORM](https://www.prisma.io/docs)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Postman Learning Center — coleções e Newman](https://learning.postman.com/)
- [LGPD — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
