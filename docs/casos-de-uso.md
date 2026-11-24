# Diagrama de casos de uso

Atores do sistema, conforme o roteiro da trilha:

- **Cliente** — pede pelo App, Totem ou Web e acompanha o status; participante do programa de fidelidade (se consentiu).
- **Atendente (Balcão)** — registra pedidos de balcão/pickup, movimenta estoque e entrega.
- **Cozinha** — inicia a preparação e marca o pedido como pronto.
- **Gerente / Administrador** — administra produtos, unidades e usuários, consulta logs e faz qualquer operação operacional.
- **Sistema Externo de Pagamento (Gateway)** — ator secundário, simulado por mock; aprova ou recusa.

```mermaid
flowchart LR
    subgraph Sistema Raízes do Nordeste
        UC1([Autenticar-se])
        UC2([Cadastrar-se com consentimento])
        UC3([Consultar cardápio da unidade])
        UC4([Criar pedido])
        UC5([Consultar e filtrar pedidos])
        UC6([Atualizar status do pedido])
        UC7([Cancelar pedido])
        UC8([Solicitar pagamento mock])
        UC9([Consultar saldo de pontos])
        UC10([Resgatar pontos])
        UC11([Administrar produtos])
        UC12([Consultar estoque])
        UC13([Movimentar estoque])
        UC14([Consultar logs de auditoria])
        UC15([Consultar perfil de usuário])
    end

    Cliente --> UC1 & UC2 & UC3 & UC4 & UC5 & UC7 & UC8 & UC9 & UC10 & UC15
    Atendente --> UC1 & UC3 & UC4 & UC5 & UC6 & UC8 & UC12 & UC13 & UC15
    Cozinha --> UC1 & UC5 & UC6 & UC12
    Gerente --> UC1 & UC5 & UC6 & UC7 & UC11 & UC12 & UC13 & UC14 & UC15
    Gateway -. aprova/recusa .-> UC8
```

## Feature crítica: Realizar Pedido + Solicitar Pagamento

- **Ator principal:** Cliente (App/Totem/Web) ou Atendente (Balcão/Pickup).
- **Pré-condições:** produtos cadastrados com estoque na unidade; cliente autenticado (perfil CLIENTE ou ATENDENTE).
- **Fluxo principal:**
  1. O ator escolhe a unidade e consulta o cardápio (GET /produtos?unidadeId=).
  2. O ator envia o pedido com `unidadeId`, `itens` (produtoId + quantidade), `canalPedido` e `formaPagamento` (POST /pedidos).
  3. A API valida unidade, produtos, disponibilidade e saldo de estoque (regras RN02–RN04).
  4. A API calcula o total no servidor, congela os preços nos itens, baixa o estoque e grava o pedido com status AGUARDANDO_PAGAMENTO, registrando o canal (RF08) e o log de auditoria.
  5. O ator solicita o pagamento (POST /pagamentos com pedidoId e formaPagamento).
  6. O gateway mock decide (RN07) e a API registra o resultado.
  7. Aprovado: pedido passa a EM_PREPARO e o cliente acumula pontos (RN08); recusado: pedido permanece AGUARDANDO_PAGAMENTO com o registro da recusa.
- **Pós-condições:** pedido persistido com itens, pagamento registrado, estoque atualizado, log de auditoria criado.
- **Exceções:** unidade/produto inexistente (404), estoque insuficiente (409, com quantidade disponível no detalhe), produto indisponível (409), canal ausente/inválido (422), pagamento de pedido não pendente (409), pedido inexistente (404), token ausente/inválido (401), perfil sem permissão (403).
- **Regras de negócio aplicáveis:** RN01 a RN08.
