# IERC-RN — arquitetura para doações únicas e recorrentes (DEV)

**Data:** 11/11/2026. **Atualizado em:** 12/11/2026. **Status:** integração de checkout/recorrência ainda em planejamento; o portal exibe a chave Pix por CNPJ informada institucionalmente para transferência manual no aplicativo bancário. **Nenhuma cobrança pelo portal está habilitada.**

## Decisão atual

A página `/apoie` distingue duas alternativas:

1. **Doação única por Pix:** o operador informou como chave institucional o CNPJ
   **08.049.504/0001-08**. A pessoa copia a chave e realiza a transferência
   **por conta própria** no aplicativo bancário, após conferir a identidade do
   destinatário. Não há cobrança ou checkout no portal.
2. **Apoio mensal recorrente:** **Em preparação** — cobranças mensais somente
   após autorização explícita da pessoa doadora e mecanismo de cancelamento.

O número foi fornecido como chave Pix da instituição em 12/11/2026,
mas **não há comprovação bancária independente de titularidade nesta revisão**.
Não criar QR Code, redirecionamento, sessão de pagamento, assinatura
ou endpoint de webhook antes das aprovações financeiras e da segurança.
A chave Pix é pública, mas segredos bancários e credenciais não são coletados.

Pagamento presencial por Pix ou dinheiro **na compra do Bazar Solidário**
não é o mesmo que doação online; não reutilizar a identificação recebida
no bazar automaticamente.

### Modelos tecnicamente distintos

- **Pix único:** a pessoa efetua uma transferência/pagamento individual.
- **Pix Automático:** a pessoa AUTORIZA a recorrência no banco ou fluxo do
  provedor antes das próximas cobranças; Pix comum não pode ser repetido
  automaticamente sem autorização. Fonte: [Banco Central —
  Pix Automático](https://www.bcb.gov.br/estabilidadefinanceira/pix-automatico).
- **Cartão recorrente:** o provedor de pagamento faz a tokenização e cuida
  das cobranças futuras. Nunca receber PAN/CVV em formulário do IERC.
- **Assinatura com cobrança Pix comum:** pode gerar novas cobranças
  mensais que o doador paga manualmente; **não** chamar de débito
  automático. Ver a [distinção documentada pelo
  Asaas](https://docs.asaas.com/docs/diferen%C3%A7a-entre-pix-autom%C3%A1tico-e-assinaturas-1).

## Arquitetura proposta (não implantada)

```text
Página /apoie (somente apresentação e escolha)
    |
    v
API de doações em backend privado e isolado
  |-- autorização e validação do plano e valor no SERVIDOR
  |-- proteção contra abuso e reenvios repetidos (rate limit/idempotência)
  |-- identificadores e segredos obtidos apenas em runtime/secret store
  |-- criação de sessão no provedor autorizado (nunca confiar em URL do cliente)
    |
    v
Checkout hospedado pelo provedor / autorização no banco
    |
    v
Webhook autenticado pelo mecanismo ESPECÍFICO do provedor
  |-- rejeitar autenticidade/identificador/ambiente inválidos
  |-- conferir evento e status diretamente com a API do provedor
  |-- deduplicar `provider_event_id` em transação no banco
  |-- registrar eventos financeiros imutáveis e status de cada ciclo
  |-- conciliar reembolsos, disputas, falhas e cancelamentos
    |
    v
Painel administrativo com acesso mínimo (não Strapi público)
    |
    v
Relatórios e prestação de contas com dados pessoais minimizados
```

**Não habilitar API de checkout/webhook enquanto não houver provedor.**
Atualmente esses endpoints simplesmente **não existem** no Next.js:
`POST /api/donations/checkout` e `POST /api/donations/webhook` devem
retornar HTTP 404. Não considerar `hidden`, `display:none`, atributo
HTML, segredo no JavaScript ou nome difícil de endpoint como proteção.

## Controles obrigatórios antes de transacionar

1. **Aprovação institucional e conta:** comprovar entidade/CNPJ recebedor,
   titularidade e autorização da direção; escolher um provedor com suporte
   aos métodos permitidos, homologar taxas, ambiente de testes, termos,
   reembolso e forma de suporte ao doador.
2. **Backend isolado:** API autenticada quando aplicável, segredos somente
   no servidor, injetados em runtime (secret store ou arquivos privados
   montados), nunca em `NEXT_PUBLIC_*`, Docker `ARG`, build estático,
   repositório público, Strapi de leitura ou resposta ao navegador.
3. **Valores e plano no servidor:** aceitar apenas `single`/`monthly`,
   moeda BRL e valores positivos dentro de limites estabelecidos pela
   administração. Evitar confiar em valores, descontos ou identificadores
   de recebedor recebidos do browser. Não permitir alteração de
   periodicidade pelo cliente após autorização.
4. **Checkout de terceiro:** criar sessão somente com API do provedor
   autenticada no backend, validar destino HTTPS e domínio allowlisted,
   nunca receber CVV, número completo de cartão ou credenciais bancárias.
5. **Recorrência consentida:** exibir valor, periodicidade, início, condições
   de cancelamento e contato; registrar consentimento comprovável sem
   armazenar dados além do necessário. Permitir cancelamento por fluxo
   seguro do provedor e atendimento institucional, sem exigir contato
   com desenvolvedor.
6. **Webhooks:** conferir autenticação conforme documentação do provedor,
   TLS e origem quando compatível; nunca confiar em apenas um status
   enviado pelo cliente ou na URL de retorno. Idempotência transacional
   por `provider_event_id`, tratamento de reenvio e fora de ordem,
   reconciliação periódica por API e auditoria de estados por ciclo.
   Webhooks de parceiros podem ser entregues mais de uma vez.
7. **Prevenção de abuso:** proteção de endpoints por rate limit, CAPTCHA
   adaptativo quando necessário, anti-CSRF para sessões com cookies,
   validação de payload, limites de tamanho, timeouts e segregação dos
   ambientes. Não criar rota pública de administração financeira.
8. **Privacidade e retenção:** definir política LGPD, prazo de retenção
   para comprovantes e documentação, controle de acesso, criptografia,
   backups e registros de acesso; jamais incluir CPF, e-mail ou tokens
   em logs de acesso, telemetria ou exemplos públicos.
9. **Testes de integração:** usar sandbox do provedor para autorização
   explícita, cobrança única e mensal, falha/recusa, evento duplicado,
   evento adulterado, replay, cancelamento, estorno, perda de conexão,
   indisponibilidade, reprocessamento e reconciliação; testar com
   teclado, ampliadores e leitores de tela.
10. **Liberação:** ativação com aprovação operacional e feature flag
    checada **no servidor**, além de validar configurações sensíveis.
    `DEV` e `PROD` devem ter credenciais, bancos e URLs distintos.
    Publicação da UI sem essas condições permanece informativa.

## Referências para avaliação do provedor

- Banco Central: https://www.bcb.gov.br/estabilidadefinanceira/pix-automatico
- Regras e etapas para recebedores: https://www.bcb.gov.br/estabilidadefinanceira/pix-automatico-recebedores
- Asaas — assinaturas: https://docs.asaas.com/docs/assinaturas
- Asaas — Pix Automático: https://docs.asaas.com/docs/pix-automatico
- Asaas — eventos duplicados/idempotência: https://central.ajuda.asaas.com/hc/pt-br/articles/55668763565979-O-que-%C3%A9-e-como-funciona-o-Webhook-do-Asaas

A menção ao Asaas não representa escolha do provedor nem significa que
a instituição já esteja elegível ou tenha aberto uma conta nele.

## Estado atual e limites de testes

- UI: chave Pix de doação única com botão de copiar, aviso de conferência
  do destinatário e cartão de recorrência `Em preparação` em `/apoie`.
- Backend de pagamentos: **não implementado**.
- Sessões de pagamento, geração de cobranças Pix, webhook e recorrência:
  **não implementados**. Pix manual externo é possível pelo aplicativo bancário.
- E2E: ausência de formulários financeiros, links de checkout,
  botões de cobrança e endpoints financeiros ativos (404).
- A página Bazar e as compras presenciais permanecem independentes.
- Não alterar o worker de notícias, Strapi, Redis, volumes, `main`
  ou produção para adiantamento visual dessa feature.

Issues de acompanhamento: #4 (financeiro e prestação de contas)
e #9 (experiência de participação e acessibilidade).
