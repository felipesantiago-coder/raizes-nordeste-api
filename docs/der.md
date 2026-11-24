# DER — Diagrama Entidade-Relacionamento

Modelo implementado exatamente como desenhado aqui: a migration `init` do Prisma cria as mesmas tabelas, chaves e relacionamentos (`prisma/schema.prisma`). Como o SQLite do Prisma não suporta ENUM, os campos de enumeração (`perfil`, `canalPedido`, `status`, `tipo`) ficam como `String` e são validados na camada de domínio.

```mermaid
erDiagram
    USUARIO {
        int id PK
        string nome
        string email UK
        string senhaHash "bcrypt"
        string perfil "CLIENTE|ATENDENTE|COZINHA|GERENTE"
        datetime dataConsentimento "LGPD"
        string versaoTermo
    }
    UNIDADE {
        int id PK
        string nome UK
        string cidade
        bool ativa
    }
    PRODUTO {
        int id PK
        string nome
        string descricao
        float precoUnitario
        string categoria
        bool disponivel
    }
    ESTOQUE {
        int unidadeId PK,FK
        int produtoId PK,FK
        int quantidade
        int minimo
    }
    MOVIMENTOESTOQUE {
        int id PK
        int unidadeId FK
        int produtoId FK
        string tipo "ENTRADA|SAIDA"
        int quantidade
        datetime dataHora
        int usuarioId FK
    }
    PEDIDO {
        int id PK
        int unidadeId FK
        int clienteId FK "opcional"
        string canalPedido "APP|TOTEM|BALCAO|PICKUP|WEB"
        string status "AGUARDANDO_PAGAMENTO|EM_PREPARO|PRONTO|ENTREGUE|CANCELADO"
        float total
        datetime criadoEm
        datetime atualizadoEm
    }
    ITEMPEDIDO {
        int id PK
        int pedidoId FK
        int produtoId FK
        int quantidade
        float precoUnitario "congelado"
    }
    PAGAMENTO {
        int id PK
        int pedidoId FK
        string provedor "MOCK"
        string formaPagamento
        string status "APROVADO|RECUSADO"
        string mensagem
        string codigoAutorizacao
    }
    CONTAFIDELIDADE {
        int clienteId PK,FK
        int saldoPontos
    }
    LANCAMENTOFIDELIDADE {
        int id PK
        int clienteId FK
        int pedidoId FK "opcional"
        string tipo "ACUMULO|RESGATE"
        int pontos
    }
    LOGAUDITORIA {
        int id PK
        int usuarioId FK "opcional"
        string acao
        string entidade
        int entidadeId
        string detalhe
    }

    USUARIO ||--o{ PEDIDO : "faz (cliente)"
    UNIDADE ||--o{ PEDIDO : "recebe"
    PEDIDO ||--|{ ITEMPEDIDO : "possui"
    PRODUTO ||--o{ ITEMPEDIDO : "compõe"
    UNIDADE ||--|{ ESTOQUE : "possui"
    PRODUTO ||--|{ ESTOQUE : "estocado"
    UNIDADE ||--o{ MOVIMENTOESTOQUE : "registra"
    PRODUTO ||--o{ MOVIMENTOESTOQUE : "movimentado"
    USUARIO ||--o{ MOVIMENTOESTOQUE : "movimentou"
    PEDIDO ||--o{ PAGAMENTO : "recebe"
    USUARIO ||--o| CONTAFIDELIDADE : "consentiu"
    USUARIO ||--o{ LANCAMENTOFIDELIDADE : "acumula/resgata"
    PEDIDO ||--o{ LANCAMENTOFIDELIDADE : "gera acúmulo"
    USUARIO ||--o{ LOGAUDITORIA : "realizou"
```

## Decisões de modelagem

- **Estoque é por unidade** (tabela associativa `Estoque` com chave composta) — atende ao cenário em que unidades têm cardápio e estoque próprios.
- **Pagamento é desacoplado do pedido** (tabela própria, um pedido pode ter mais de uma tentativa) — reflete a arquitetura com gateway externo simulado.
- **Preço é congelado no `ItemPedido`** — mudanças futuras de preço não reescrevem o histórico.
- **`clienteId` em Pedido é opcional** — pedidos de balcão podem ser feitos sem cliente cadastrado; fidelidade só existe com cliente identificado e consentimento registrado.
- **LogAuditoria é genérico** (entidade + entidadeId) — cobre pedido, status, estoque, pagamento, fidelidade e acesso a dados pessoais sem criar uma tabela por tipo de log.
