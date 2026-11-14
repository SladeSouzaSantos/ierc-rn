# IERC-RN — doações materiais e contribuições mensais

**Revisão:** 14/11/2026. **Escopo:** primeiro implementar em `dev` e integrar `main` após CI. **Checkout real desativado até autorização do Instituto.**

## Doações materiais

O Instituto informou que recebe **alimentos não perecíveis**, **material de limpeza** e já aceita doações de roupas, sapatos e bolsas em bom estado para o bazar. A página `/apoie` diferencia:

- **Bazar Solidário:** roupas/sapatos/bolsas em bom estado. Compra às terças-feiras, 08h–11h, na sede do IERC; entrega desses itens segunda–quinta, 08h–11h, presencialmente, sem coleta domiciliar, conforme informação institucional já registrada.
- **Alimentos não perecíveis e materiais de limpeza:** opções confirmadas de doação, mas **sem inventar horário específico ou lista de produtos**; recomenda confirmar prioridades e entrega diretamente com a instituição.
- **Pix avulso:** chave CNPJ `08.049.504/0001-08` fornecida pelo operador, mantida no portal; o pagador deve conferir que o nome do recebedor no banco é o IERC-RN.

## Modalidades recorrentes e limitação real dos provedores

O IERC-RN precisa aceitar formalmente termos de uso, taxas, titularidade, política de cancelamento e prestação de contas antes de ativar checkout. Nenhuma API key ou dado de cartão entra no site.

| Modalidade | Fluxo preparado | O que falta para habilitar |
| --- | --- | --- |
| **Pix mensal** | Link de pagamento **RECURRENT** do Asaas, que gera nova cobrança Pix mensal; a pessoa paga manualmente cada mês. | Conta Asaas PJ confirmada; link criado e validado em conta da instituição; configurações seguras do portal. |
| **Cartão de crédito mensal** | Link hospedado **RECURRENT / CREDIT_CARD** do Asaas; o provedor tenta a cobrança mensal após autorização. | Conta PJ, taxas/termos, link de assinatura real e acesso à gestão de cancelamento/recibos. |
| **Pix Automático** | **Não confundir** com Pix mensal. Necessita autorização bancária específica para débitos futuros sem aprovação a cada ciclo. | Elegibilidade PJ, CNPJ 6+ meses, Pix cadastrado, autorização e webhooks homologados no Asaas. **Não ativado pela integração de links.** |
| **Cartão de débito recorrente** | Interface informativa, checkout ainda bloqueado. Débito pinless pode existir em gateways credenciados, mas **não é oferecido pelo fluxo de links recorrentes escolhido**. | Instituição contratar/adquirente com recorrência de débito homologada; API/checkout e autenticação, webhooks, taxas e consentimento. |

**Importante:** o provedor Asaas admite links de assinatura recorrente com `billingType=PIX` ou `CREDIT_CARD`. **Isso não habilita automaticamente Pix Automático e não garante débito recorrente por cartão.** Não apresentar esses meios como disponíveis antes da habilitação contratual.

Referências do provedor:
- [Links recorrentes Asaas](https://docs.asaas.com/docs/criando-um-link-de-pagamentos)
- [Diferença entre Pix Automático e assinaturas](https://docs.asaas.com/docs/diferen%C3%A7a-entre-pix-autom%C3%A1tico-e-assinaturas-1)
- [Requisitos Pix Automático na API](https://central.ajuda.asaas.com/hc/pt-br/articles/58142383374107-Como-funciona-o-Pix-Autom%C3%A1tico-na-API-do-Asaas)
- [Débito recorrente pinless Pagar.me — elegibilidade Gateway](https://docs.pagar.me/docs/cart%C3%A3o-de-d%C3%A9bito)
- [Migração URLs públicas Asaas, setembro/2026](https://docs.asaas.com/changelog/altera%C3%A7%C3%A3o-na-estrutura-de-urls-p%C3%BAblicas-do-asaas)

## Arquitetura da primeira entrega

```
Página /apoie (Next.js, server-rendered)
  ├─ chave Pix avulsa pública (não cria cobrança)
  ├─ alimentos / limpeza / bazar / contato
  └─ seletor acessível R$ 20/50/100 × Pix mensal ou cartão de crédito
      ├─ sem configuração/validação do recebedor: botão desabilitado
      └─ com aprovação + URL Asaas HTTPS validada:
            redirect para checkout hospedado pelo Asaas
                 └─ doador consente; Asaas mantém assinatura,
                    novas cobranças e notificações financeiras
```

Não há formulário de CPF, e-mail, dados de cartão, webhook ou endpoint de criação pública de assinatura no Next.js. Isso reduz a superfície PCI/LGPD e evita cobranças duplicadas ou abuso de um endpoint anônimo. O estado financeiro é consultado/gerido no painel do provedor, **não no CMS**. Um pagamento só é comprovado por conciliação do provedor, nunca por retorno do navegador.

## Sandbox, somente com autorização local

Os valores sugeridos da interface são **R$ 20, R$ 50, R$ 100 por mês**; não representam planos obrigatórios do IERC. Ajustes dependem de consentimento da instituição.

A ferramenta `scripts/asaas-recurring-links.mjs` gera plano offline sem consumir API:

```bash
cd /opt/projects/ierc-rn-dev
node scripts/asaas-recurring-links.mjs --plan
```

Com **chave sandbox Asaas própria**, a equipe pode criar seis links de teste (Pix mensal e crédito, três valores cada). Este comando **não aceita produção**:

```bash
# Em terminal privado. Nunca envie token ao chat ou ao GitHub.
read -rs -p "Token Asaas SANDBOX: " ASAAS_SANDBOX_API_KEY; echo
export ASAAS_SANDBOX_API_KEY
IERCRN_SANDBOX_LINKS_ACK=SANDBOX_LINKS_ONLY_NO_LIVE_CHARGES \
  node scripts/asaas-recurring-links.mjs --sandbox-create
unset ASAAS_SANDBOX_API_KEY
```

A ferramenta retorna apenas URLs públicas de sandbox; não incorpora credenciais ou cria assinaturas na conta real. **Não execute novamente após erro/timeout sem conferir o painel** para evitar links duplicados.

## Ativação de produção — gate institucional, ainda pendente

1. Diretoria confirma **CNPJ, beneficiário bancário, titular da conta Asaas, valores, taxas, política de reembolso, cancelamento e tratamento de dados**. A chave Pix informada **não comprova** que uma conta gateway já está habilitada.
2. Configurar a conta e gerar em seu **painel Asaas de produção** links reais por valor e meio, com `chargeType=RECURRENT`, `subscriptionCycle=MONTHLY`; Pix `billingType=PIX`, crédito `billingType=CREDIT_CARD`. O preenchimento de cada link deve gerar assinatura no provedor, sem exigir cartão no portal.
3. Conferir visualmente **nome/CPF ou CNPJ recebedor, domínio `www.asaas.com`, valor, periodicidade e custos** em cada link. O provedor alterou gradualmente URLs de `/c/id` para `/000/c/id`; armazenar a URL exata recebida, nunca construí-la a partir de ID.
4. Inserir exclusivamente no arquivo privado `deploy/.env.portal.dev` ou `deploy/.env.portal.prod` (na pasta e branch correspondente) as variáveis demonstradas em `deploy/donations-recurring.env.example`:
   - `IERCRN_DONATIONS_RECURRING_ENABLED=true`
   - `IERCRN_DONATIONS_RECEIVER_VERIFIED=true` **somente depois da validação**
   - `IERCRN_DONATIONS_GATEWAY=asaas`
   - `IERCRN_DONATIONS_RECEIVER_CNPJ=08049504000108`
   - `IERCRN_DONATIONS_HOSTED_LINKS_JSON='{"pix":{"20":"<URL REAL>"},"credit":{"20":"<URL REAL>"}}'` — exemplo com placeholders, **não usar URLs inventadas**
5. Recriar apenas o serviço portal para recarregar variáveis de ambiente **após autorização**. O código verifica domínio HTTPS e links `/c/` com ou sem prefixo de conta; se a configuração for inválida, bloqueia o checkout inteiro. Nunca usar link sandbox em PROD.
6. Realizar assinatura de teste autorizada **somente no ambiente homologado**, observar estado da cobrança no provedor, cancelamento, tentativa de renovação e comprovante. Validar WCAG, teclado e leitor de tela na página hospedada também.
7. Definir responsável pela conciliação e prestação de contas. **Não** interpretar um link criado ou redirecionamento como doação efetivamente recebida.

Apenas após o gate 7 o IERC poderá divulgar o checkout como forma ativa de arrecadação.

## Próximas integrações separadas

- **Pix Automático (autorização de mandato):** desenvolver jornada própria com cliente, QR Code inicial, `paymentCreationMode=SUBSCRIPTION`, webhooks autenticados, consentimento e cancelamento; só após confirmação da elegibilidade no Asaas. Não misturar Pix mensal manual com Pix Automático.
- **Débito pinless:** validar contrato e documentação Pagar.me/credenciadora, então habilitar método recorrente de débito se realmente disponível ao Instituto. Não enviar dados sensíveis do cartão ao Next.js.
- **Operação financeira:** webhooks autenticados com `asaas-access-token`, idempotência persistida (eventos at-least-once), extrato/relatório auditável, aviso de privacidade e fluxo de contestação. Sem armazenamento confiável, **não criar webhook falso**.
- **Acessibilidade humana:** NVDA/VoiceOver/TalkBack, reflow 320 CSS px, zoom 200%/400% e conformidade visual do checkout hospedado.

Documentação relacionada: [Issue #4](https://github.com/SladeSouzaSantos/ierc-rn/issues/4), [Issue #9](https://github.com/SladeSouzaSantos/ierc-rn/issues/9), [Aprovações institucionais](CONTEUDO-E-APROVACOES.md).
