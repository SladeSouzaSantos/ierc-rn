# IERC-RN — Apoie o Instituto, primeira entrega sem pagamentos (DEV)

**Data:** 11/11/2026. **Escopo:** Sprint 4, página `/apoie` na `dev`.

## Objetivo e limites

A área Apoie passa a explicar como a comunidade pode procurar a instituição
para colaborar, sem assumir a existência de um programa formal de voluntariado,
de um canal para entrega de objetos, de meios de pagamento ou de campanhas
financeiras sem aprovação institucional.

A implementação preserva a identidade visual do portal, funciona sem o CMS
ativo e **não** cria formulário, armazenamento de dados, QR Code, chave Pix,
checkout, links de pagamento ou funcionalidades bancárias.

## Estrutura entregue

1. **Bazar Solidário** em destaque, com a referência histórica a
   **terças-feiras** e a orientação explícita para **confirmar a programação**
   antes de visitar. O site não declara horários, endereço específico de
   entrega, regras de compras ou lista de itens aceitos como atuais.
2. **Três formas de apoio**:
   - Doar itens, somente após confirmar critérios e possibilidade de entrega;
   - Conhecer o bazar, após verificar dia, horário e disponibilidade;
   - Divulgar os canais da instituição ou conversar sobre eventual
     colaboração, sem anunciar vagas ou programas de voluntariado inexistentes.
3. **Três passos para apoiar com segurança:** conhecer, confirmar necessidades
   e combinar diretamente a participação.
4. **Informação financeira inequívoca:** o site ainda não recebe Pix,
   cartão nem pagamento recorrente.
5. **Chamadas úteis e acessíveis:** links internos existentes para
   `/contato` e link ao perfil Instagram informado
   `https://www.instagram.com/iercrn/` (nova aba identificada).
   Nenhum telefone, endereço para doação ou conta bancária foi inventado.

O código está no componente `components/support-page.tsx` e em CSS
estritamente escopado com prefixo `.support-` em `app/globals.css`.
A rota `app/[slug]/page.tsx` reutiliza o componente, sem novos serviços.

## Verificações

`tests/support-page.spec.ts` cobre:
- organização dos três meios não financeiros e referência condicional
  de terças-feiras;
- ausência de formulário, Pix, QR Code, checkout, links para pagamento,
  telefone ou e-mail fictícios;
- links de contato e Instagram, comportamento de nova aba e âncoras;
- reflow sem rolagem horizontal em 320, 375, 768 e 1440 px;
- acessibilidade automática com axe-core (WCAG A/AA).

Esses testes automatizados **não substituem** validação manual em zoom
200%/400%, NVDA, VoiceOver e TalkBack com pessoas usuárias.

## Pontos que precisam de confirmação institucional

Antes de atualizar o conteúdo da página com detalhes operacionais,
solicitar ao IERC-RN validação de:
- funcionamento semanal atual do bazar e horário efetivo;
- itens que podem ser recebidos, conservação e critérios de entrega;
- endereço/ponto de entrega e instruções de recebimento;
- existência de oportunidades de colaboração e pessoa responsável pelo contato;
- políticas de imagem e autorização de fotografias;
- se haverá recebimento financeiro e quem responderá pelas transações.

Somente após as confirmações, avaliar mover dados operacionais para campos
editáveis e aprovados no CMS. Não publicar informações presumidas.

## Etapa financeira — NÃO implementada

As issues #4 e #9 permanecem abertas para avaliação de titularidade da
conta recebedora, gateways Pix/cartão, cobrança recorrente, comprovantes,
webhooks assinados, prevenção de duplicidade, LGPD, prestação de contas e
teste com tecnologias assistivas.

Não adicionar chave Pix, QR Code, endpoint de pagamento ou gravação de
dados financeiros antes de autorização formal.

## Homologação e deploy

Desenvolvimento ocorre apenas na `dev`. Após CI do portal aprovado,
atualizar somente o portal DEV existente:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
git rev-parse --short HEAD
docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml up -d --build portal
docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml ps
```

Verificar visualmente `http://127.0.0.1:3101/apoie` em desktop e celular.
**Não** reconstruir Strapi, worker IA, monitor ou Redis. **Não** usar
`docker compose down -v`. `main` e PR #12 Draft preservados.
