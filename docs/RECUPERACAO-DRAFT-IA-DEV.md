# DEV — recuperar um rascunho de notícia EBC retido após a revisão por IA

## Situação confirmada em 13/11/2026

A janela das 13h (America/Fortaleza) foi reservada no Redis, e o
worker registrou `run_completed`, `count:1`, `published:0`,
`draftsCreated:1` e
`statusCounts:{"draft_created_review_pending":1}`.

O Strapi DEV contém a notícia EBC “Enem 2026 estreia apoio emocional e
novas regras de acessibilidade” com status `Draft`, `aiAssisted=true`,
`editorialStatus=em_revisao`, fonte original Agência Brasil e imagem
não adicionada. **O agendamento funcionou; a aprovação automática foi
retida.** A causa exata (e.g. hold editorial, modelo indisponível,
problema com a evidência ou quotas) não consta de `run_completed`;
logs do contêiner anterior podem ter sido perdidos após `--force-recreate`.
Um `hold` é um bloqueio correto, não uma autorização para publicar.

## Contrato de recuperação

`src/cli.mjs retry-pending DOCUMENT_ID` permite na DEV **somente uma
recuperação explícita de um único draft existente**, sem regenerar
artigo, criar novo Draft ou alterar conteúdo editorial. O fluxo:

1. Exige `CURATOR_ENABLED=true`, `CURATOR_WRITE_DRAFTS=true`,
   `CURATOR_AUTO_PUBLISH_ENABLED=true`, revisão integral e
   `CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED`, mais
   allowlist restrita às fontes licenciadas e tokens distintos.
2. Usa token Publisher exclusivo (News-article: `findOne`/`update`)
   para buscar a versão `published` (rejeita notícia já publicada)
   e a versão `draft`. Confirma `originType=externa`,
   `aiAssisted=true`, `editorialStatus=em_revisao`, nota original
   gerada pelo worker e ausência de imagem.
3. Confere URL HTTPS, domínio, categoria EBC, data dentro dos 45 dias,
   hash dedupe, fonte, idioma, título original, slug e texto inalterado.
4. Reserva lock Redis por hash da fonte e refaz extração de texto
   integral com verificação de autoria/licença. Usa as cotas Redis
   existentes e o fallback Groq → Gemini → OpenRouter.
5. Executa novamente a segunda revisão independente com duas
   evidências literais de blocos distintos. Uma resposta `hold`,
   inválida, sem cotas ou sem evidência preserva `Draft`.
6. **Somente após aprovação completa**, refaz um GET do draft
   exato antes de PUT `status=published`; o Publisher confirma
   `publishedAt` e `editorialStatus=aprovado` antes de registrar
   deduplicação Redis. Não apaga conteúdo nem chaves Redis de agenda.

Os requisitos especiais de PROD permanecem: instância `prod` exige
os ACKs de produção, tokens e Redis privados, sem herdar autorizações
da DEV. Não promover este incremento à MAIN sem homologação.

## Comandos seguros no MiniMac DEV

Primeiro reconstruir **somente a imagem**, sem reiniciar o worker que
continua agendado:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/preflight-curator-autopublish-dev.sh
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator build worker
```

Localizar o **documentId** do rascunho, sem copiar segredo do `.env`:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/list-pending.mjs
```

Esse comando usa somente o token Reader DEV e um GET filtrado para
Drafts externos gerados por IA com `editorialStatus=em_revisao`;
mostra apenas `documentId` e título, até 20 itens. O `ID=5` da
tabela Strapi **não** é o `documentId` usado pelo endpoint.

Confirmar que o `documentId` retornado pertence à notícia do Enem,
e executar **uma única vez**:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/cli.mjs retry-pending DOCUMENT_ID_EXATO
```

**Este último comando pode PUBLICAR uma notícia real na DEV.**
Não executar com um ID de outra notícia nem em `/opt/projects/ierc-rn`
MAIN. Não repetir indefinidamente para contornar revisão negativa
ou cotas. O teste não exige alterar `.env` nem apagar keys Redis.

Resultados esperados:

- `draft_published`: o **mesmo** documento passou em todas as
  verificações e foi confirmado publicado pelo Strapi.
- `draft_review_pending` / `pending_review_held`: revisão continua
  inconclusiva, matéria preservada em Draft. Inspecionar eventos
  `llm_attempt` para entender `review_json_syntax`, modelo,
  quotas, citações ou decisão `hold` (não imprimir a resposta integral).
- `locked`: outro processamento reservou a mesma fonte. Não
  remover manualmente o lock; conferir execução concorrente.
- `Pending Draft changed ...` ou fonte/licença indisponível:
  corrigir a causa editorial/contratual **sem forçar publicação**.
- `Publisher ... failed`: consultar estado no CMS antes de nova tentativa.

Depois, confirmar o documento em `Content Manager → Notícias`, o
status `Published` e a presença no `/radar-da-inclusao`. Se
não houver notícias aprovadas, manter `Draft`. O agendador das
08h/13h/19h permanece independente, mas **não tenta recuperar
automaticamente** os Drafts anteriores: essa política de retomada
recorrente requer implementação e testes específicos antes de ativar.

O texto do campo `approvalNote` inicial é o aviso conservador
padrão do worker. Não equivale a comprovação de que uma revisão
humana ou automática foi concluída.

Segurança: não compartilhar chaves API, `.env`, tokens do CMS,
texto integral da notícia ou evidências de terceiros nos logs.
Compartilhar somente campos de status e categorias fixas de falha.


## Diagnóstico real do ENEM — 13/11/2026, 16h22 Fortaleza

O operador executou **uma recuperação única** do documento
`nxh3gri9njyrag8uvbtgux4i`, identificado pelo
`list-pending.mjs`, com o código DEV anterior. A execução retornou:

- Groq: `invalid_output` / `review_invalid_quotes_type`;
- Gemini: `invalid_output` / `review_missing_fields`;
- OpenRouter: `invalid_output` / `review_invalid_support`;
- `pending_review_held`, `reason=review_unavailable`;
- resultado `draft_review_pending`, sem publicação ou nova notícia.

**Não houve demonstração de erro de licença, fonte ou CMS nesta tentativa.**
Os três erros acima dizem respeito ao contrato de saída da revisão
independente. O diagnóstico sintético anterior passou em todos os
modelos, mas isso não garantia aderência do contrato ao artigo real.

A correção incremental na DEV agora:

1. Usa JSON Schema nos modelos exatos Groq GPT-OSS 120B
   (`strict:true`), Gemini 2.5 Flash (`strict:true`) e
   OpenRouter Nemotron 3.5 Super VL gratuito (`strict:false`, melhor
   esforço); outros modelos, fases e provedores mantêm o contrato
   anterior.
2. Instrui todos a retornar **sempre cinco campos**, sem strings como
   `"partial"` no campo `factualSupport`; `hold` significa
   `insufficient`, arrays existentes e vazios quando apropriado.
3. Reserva `evidenceQuotes` para duas substrings LITERAIS de blocos
   diferentes, com 12–160 caracteres, somente quando `approve`.
   Para `hold`, `evidenceQuotes:[]` é válido.
4. Mantém `validateReview`, `verifyFullArticleReview`, o gate de
   publicação do Strapi, direitos de reutilização, validação byte a
   byte do Draft existente e quotas intactos. **O sistema nunca corrige
   automaticamente campos ausentes ou transforma uma retenção em
   aprovação.**

Depois que o CI da DEV estiver verde, reconstruir a imagem com
`docker compose ... build worker` como acima, testar os contratos
com um diagnóstico sintético **sem escrita** (cotas gratuitas reais):

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/diagnose-review-schema.mjs
```

Se houver cotas e o novo contrato funcionar, executar a recuperação
supervisionada **uma única nova tentativa** sobre o mesmo documento:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/cli.mjs retry-pending nxh3gri9njyrag8uvbtgux4i
```

Esse último comando **PODE PUBLICAR NA DEV** caso a nova revisão,
os fatos, as citações, a licença e a integridade sejam aprovados.
Um resultado `draft_review_pending` ou `ai_review_hold` significa
que o bloqueio continua correto. Nunca forçar a aprovação nem remover
locks/keys do Redis para repetir chamadas. Se o artigo tiver sido
editado manualmente, não tentar a recuperação: exige novo fluxo
editorial.
