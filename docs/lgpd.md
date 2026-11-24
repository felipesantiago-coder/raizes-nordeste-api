# LGPD — declaração de privacidade do back-end

Como a API trata dados pessoais, em conformidade com a Lei nº 13.709/2018 (LGPD) e com o cenário do estudo de caso ("Conhecer o cliente é importante, mas respeitar sua privacidade é obrigatório").

## Dados pessoais coletados

| Dado | Finalidade | Base legal |
|---|---|---|
| Nome | Identificação do usuário nos pedidos e no atendimento | Execução de contrato (art. 7º, V) |
| E-mail | Autenticação (login) e identificação única da conta | Execução de contrato (art. 7º, V) |
| Senha (apenas como hash bcrypt) | Segurança da conta | Proteção (art. 7º, IX) |
| Consentimento (data + versão do termo) | Participação no programa de fidelidade | Consentimento (art. 7º, I) |
| Pedidos, itens e pagamentos | Operação do negócio (venda e preparo) | Execução de contrato (art. 7º, V) |
| Pontos e lançamentos de fidelidade | Programa de fidelidade | Consentimento (art. 7º, I) |

## Princípios aplicados

- **Minimização:** o cadastro público coleta apenas nome, e-mail e senha; não há CPF, endereço, telefone ou qualquer dado sensível no MVP.
- **Segurança:** senha nunca é armazenada em texto puro (hash bcrypt com salt) e nunca retorna nas respostas — `senhaHash` é removido em todos os serializers.
- **Consentimento explícito:** o cliente decide no cadastro (`aceitaFidelidade`); a API registra `dataConsentimento` e `versaoTermo`. Sem consentimento, não existe conta de fidelidade e nenhum ponto é acumulado (RN08).
- **Auditoria de acessos:** toda consulta a dados pessoais de outro usuário (GET /usuarios/{id} por GERENTE) gera log `ACESSO_DADOS_PESSOAIS` com autor, alvo e data/hora.
- **Fim de vida da sessão:** tokens JWT expiram (padrão 8h); não há dados de sessão persistentes.

## Retenção e anonimização

- Os pedidos precisam ser conservados para integridade operacional e financeira da rede (interesse legítimo da operação); não contêm mais dados pessoais do que o identificador do cliente.
- Estratégia planejada (evolução do MVP): ao pedido de exclusão do titular, a conta é anonimizada (nome/e-mail substituídos por pseudônimo) e os pedidos permanecem agregados sem vínculo identificável — preservando relatórios da matriz sem manter dados pessoais identificáveis.

## Direitos do titular

A API expõe ao próprio usuário a leitura dos seus dados (GET /usuarios/{id} e GET /fidelidade/lancamentos) e o histórico do seu consentimento (GET /fidelidade/saldo traz `consentimentoFidelidade` e `versaoTermo`). Rotas de correção e exclusão de conta são extensões documentadas na arquitetura.
