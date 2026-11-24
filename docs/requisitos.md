# Requisitos do sistema

Requisitos levantados a partir do estudo de caso "Rede Raízes do Nordeste" e do roteiro da trilha Back-end. O recorte deste projeto é o back-end: nada aqui descreve telas.

## Requisitos funcionais (RF)

| ID | Requisito | Prioridade |
|---|---|---|
| RF01 | Cadastro e autenticação de usuários com perfis (CLIENTE, ATENDENTE, COZINHA, GERENTE) e senha armazenada como hash | Essencial |
| RF02 | Gestão de unidades da rede (cada unidade tem cardápio e estoque próprios) | Essencial |
| RF03 | Consulta do cardápio por unidade, com produtos disponíveis naquele local e saldo em estoque | Essencial |
| RF04 | CRUD administrativo de produtos (GERENTE) | Essencial |
| RF05 | Controle de estoque por unidade: consulta de saldo, entrada e saída com rastreabilidade de quem movimentou | Essencial |
| RF06 | Restrição de venda por indisponibilidade: pedido não é aceito sem saldo em estoque | Essencial |
| RF07 | Criação de pedidos com itens, valores calculados no servidor e status | Essencial |
| RF08 | Multicanalidade: pedido registra `canalPedido` (APP, TOTEM, BALCAO, PICKUP, WEB), campo obrigatório na criação e filtrável na consulta | Essencial |
| RF09 | Atualização de status do pedido (EM_PREPARO → PRONTO → ENTREGUE) com transições válidas por perfil | Essencial |
| RF10 | Cancelamento de pedido permitido apenas antes do início da preparação, devolvendo o estoque | Essencial |
| RF11 | Pagamento desacoplado via serviço externo simulado (mock): solicita, recebe aprovação/negativa, registra o resultado e atualiza o status | Essencial |
| RF12 | Programa de fidelização: acúmulo de pontos no pagamento aprovado (1 ponto a cada R$ 10), saldo e resgate simples (múltiplos de 100 pontos) | Alta |
| RF13 | Fidelização condicionada a consentimento LGPD registrado no cadastro (data e versão do termo) | Essencial |
| RF14 | Promoções e campanhas — regra documentada (como aplicar sobre o pedido), sem implementação no MVP | Média |
| RF15 | Logs/auditoria de ações sensíveis (pedido, status, estoque, pagamento, resgate, acesso a dados pessoais) | Essencial |
| RF16 | Consulta de logs por GERENTE, filtrável por entidade | Alta |

## Regras de negócio (RN)

- **RN01** — `canalPedido` é obrigatório e validado contra os valores permitidos; ausente ou inválido, a API responde 422.
- **RN02** — O total do pedido é calculado no servidor a partir do `precoUnitario` gravado no banco; valores enviados pelo cliente são ignorados.
- **RN03** — O preço é congelado no item do pedido no momento da venda (mudança futura de preço não altera pedidos passados).
- **RN04** — Pedido com produto inexistente responde 404; com estoque insuficiente ou produto indisponível responde 409.
- **RN05** — Transições de status válidas: pagamento aprovado move AGUARDANDO_PAGAMENTO → EM_PREPARO; COZINHA/GERENTE movem EM_PREPARO → PRONTO; ATENDENTE/GERENTE movem PRONTO → ENTREGUE; CANCELADO só a partir de AGUARDANDO_PAGAMENTO.
- **RN06** — Cancelamento devolve os itens ao estoque da unidade.
- **RN07** — O mock de pagamento aprova qualquer forma de pagamento válida, exceto `CARTAO_RECUSADO`, que serve de gatilho determinístico para o cenário de recusa nos testes.
- **RN08** — Pontos de fidelidade são acumulados apenas quando o cliente consentiu (`dataConsentimento` preenchido).
- **RN09** — Resgate exige saldo suficiente e valor múltiplo de 100 pontos (100 pontos = R$ 10 de desconto, cupom registrado no histórico).
- **RN10** — Ações sensíveis geram registro em LogAuditoria com usuário, ação, entidade e detalhe.

## Requisitos não funcionais (RNF)

| ID | Requisito |
|---|---|
| RNF01 | Segurança: senha com hash (bcrypt), autenticação por token JWT com expiração e autorização por perfil em cada rota |
| RNF02 | LGPD: coleta mínima (nome, e-mail), finalidade declarada, consentimento registrado, sem exposição de dados sensíveis nas respostas |
| RNF03 | Logs/auditoria de ações sensíveis e de acesso a dados pessoais |
| RNF04 | Documentação da API em OpenAPI/Swagger refletindo os endpoints reais |
| RNF05 | Padrão único de erro em JSON (error, message, details, timestamp, path) em todas as falhas |
| RNF06 | Listagens paginadas (page, limit) e URLs no plural com IDs no path |
| RNF07 | Tolerância a falhas na integração de pagamento: falha do mock não altera o pedido além do registro coerente |
| RNF08 | Desempenho em pico: consultas paginadas e operações de pedido em transação única (consistência de estoque) |

## Escopo do MVP

Fluxo crítico fechado ponta a ponta: **criar pedido (validando estoque) → pagamento mock → atualização de status**, com autenticação JWT por perfis, `canalPedido`, fidelidade com consentimento e logs de auditoria.

Fica fora do MVP, documentado como evolução: promoções implementadas (RF14 é regra documentada), refresh token e revogação de sessão, relatórios consolidados da matriz e integração real com gateway de pagamento.
