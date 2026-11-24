# Arquitetura — organização em camadas

O projeto segue a separação em quatro camadas exigida pelo roteiro. As pastas tornam a separação explícita; nenhum arquivo de uma camada importa detalhes técnicos de outra sem passar pela camada imediatamente abaixo.

| Camada | Pasta | Responsabilidade | Exemplos |
|---|---|---|---|
| **Domain** | `src/domain/` | Entidades conceituais, regras de negócio, validações e erros do domínio | `validacoes.js` (canalPedido, transições de status), `erros.js` (AppError, erros 400/401/403/404/409/422) |
| **Application** | `src/application/` | Casos de uso que orquestram o fluxo | `pedidoService` (criar pedido, atualizar status), `pagamentoService`, `estoqueService`, `fidelidadeService`, `authService`, `logService` |
| **Infrastructure** | `src/infrastructure/` | Persistência (Prisma), integração de pagamento mock | `prisma.js` (cliente único), `pagamento-mock.js` (gateway simulado) |
| **API** | `src/api/` | Rotas Express, middlewares de autenticação/autorização, handler de erro padronizado, Swagger | `routes/*.js`, `middlewares/auth.js`, `middlewares/erro.js` |

```text
src/
├── server.js                 # sobe o servidor (ponto de entrada)
├── app.js                    # monta o Express (app isolado para testes)
├── api/
│   ├── routes/               # auth, usuarios, unidades, produtos, estoque, pedidos, pagamentos, fidelidade, logs
│   └── middlewares/          # autenticação JWT, autorização por perfil, erro padronizado
├── application/              # casos de uso (regras orquestradas, transações)
├── domain/                   # validações e erros de negócio (sem dependência de Express)
└── infrastructure/           # Prisma client e gateway de pagamento mock
```

## Decisões técnicas

- **Express 4 + JavaScript (sem TypeScript):** menor curva de aprendizado e ecossistema abundante, conforme o plano do projeto.
- **Prisma + SQLite:** migrations e seed nativos (exigência de persistência real) sem servidor de banco; o mesmo modelo do DER vira a migration.
- **ENUM via camada de domínio:** o Prisma/SQLite não suporta enums nativos; as listas de valores permitidos vivem em `src/domain/validacoes.js` e toda escrita passa por lá.
- **Transações no pedido:** criação e baixa de estoque ocorrem em uma única transação (`prisma.$transaction`) para evitar venda sem saldo em horário de pico.
- **Erro padronizado único:** qualquer falha vira `{ error, message, details, timestamp, path }` no handler central.
- **JWT com perfis:** middleware `requireAuth` + `requirePerfil(...)` declarado rota a rota, conforme os acessos da tabela de endpoints.
