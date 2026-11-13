# Diagnóstico da segunda revisão IA (DEV, somente conteúdo sintético)

## Finalidade

O operador confirmou em 13/11/2026 que o agendador DEV iniciou com
`writeDrafts:true`, `autoPublish:true` e `archiveDiscovery:true`.
Isso **não** comprova que a publicação automática completou. A última
`review-full-preview` encontrou zero candidatas EBC com pertinência e
bloqueou Perkins por permissão de reutilização pendente; não exercitou
a segunda revisão por IA.

Já ocorreu em produção `schema_rejected` nas três LLMs ao tentar
revisar um Draft original EBC, que **permanece pendente no Strapi PROD**.
Precisamos distinguir erro JSON, campos ausentes, quota, reasoning ou
citações insuficientes sem expor a reportagem e sem autorizar publicação
incorreta.

O diagnóstico `curator/src/diagnose-review-schema.mjs` usa
o mesmo `VERIFIED_REVIEW_SYSTEM`, `validateReview`,
`verifyFullArticleReview` e `FreeLlmRouter` reais, mas com três
blocos de texto e uma síntese **integralmente fictícios**.
Tenta uma requisição **por provedor** gratuito configurado, em sequência,
sem fallback entre os provedores: Groq, Gemini, OpenRouter e Ollama
(opcional). Produz apenas diagnósticos JSON com categorias fixas.

## Segurança e efeitos

- Obrigatoriamente `CURATOR_INSTANCE_KIND=dev`. Rejeita PROD.
- Não lê `CURATOR_STRAPI_*`, não abre conexão CMS, não faz
  `POST/PUT` no Strapi, não cria Drafts, não altera artigos ou Redis
  de deduplicação nem consulta feeds/copyright.
- Apenas conexão Redis DEV para **cotas de modelo e cooldown** e
  chamadas às APIs de IA gratuitas já configuradas; no máximo
  uma tentativa por provedor. O teste **consome cotas reais** e pode
  registrar cooldown de revisão se um modelo falhar. Não executar
  repetidamente ou perto do slot agendado se as cotas estiverem baixas.
- **Nunca** imprime chaves de API, tokens CMS, textos retornados
  pelos modelos, blocos de evidência nem prompts.
- `schema_valid` significa que o modelo cumpriu o formato JSON;
  `evidenceGate` avalia **somente os dados sintéticos**. Não
  equivale a autorização para publicar artigos reais nem homologa
  a qualidade editorial de notícias.
- `schema_unavailable` identifica falha ou bloqueio; o campo
  `reason` usa categorias fixas (`review_missing_fields`,
  `review_json_syntax`, `token_limit`,
  `reasoning_without_text` etc.). Um `category` de
  `skipped_or_unavailable` pode indicar cooldown/quota existente
  sem nova requisição. Preserve as políticas de proteção e não
  aumente cotas apenas para obter aprovação.

## Execução manual no MiniMac DEV

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/diagnose-review-schema.mjs
```

Para investigar exclusivamente **Groq**, sem gastar chamadas Gemini e
OpenRouter, use em vez da última linha:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/diagnose-review-schema.mjs groq
```

A saída continua com `synthetic:true` e `cmsWrites:0`.
`providersChecked:1` é esperado neste modo.

### Correção para erro Groq `review_json_syntax`

A primeira execução sintética registrou `review_json_syntax` no
`openai/gpt-oss-120b`, enquanto Gemini 2.5 Flash e OpenRouter
Nemotron passaram no contrato de cinco campos e duas citações
independentes.

O `router.mjs` da **DEV** passou a enviar, somente nas chamadas Groq
`phase:'review'` para o modelo exato `openai/gpt-oss-120b`,
`response_format: {type:'json_schema',json_schema:{strict:true,...}}`
com os cinco campos obrigatórios, tipos, enumerações e
`additionalProperties:false`.

Isso usa o modo estrito documentado pela Groq sem alterar prompting,
modelo, fallback, quotas, redação, decisões `hold`, nem os validadores
locais (citações literais de dois blocos diferentes, licença e artigo
integral). O JSON pode ser válido e ainda ser **reprovado**, como deve.

Referências oficiais:
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/model/openai/gpt-oss-120b

Não faça `up --force-recreate` do scheduler: o diagnóstico usa um
contêiner efêmero e a imagem recém-compilada, sem reiniciar o worker
permanente. Não requer alterar o `.env`.

Resultado esperado: um evento `review_schema_diagnostic` por modelo,
e um `review_schema_diagnostic_completed` final com
`synthetic:true`, `cmsWrites:0` e `providersChecked`.
Se não houver cota/Redis, o resultado pode ser indisponível;
não representa uma falha de segurança.

## Próxima ação

Compartilhe apenas os eventos JSON de diagnóstico (sem `.env`).
A partir da **categoria específica de cada provedor**, faça a
correção direcionada do parser/prompt da segunda revisão na branch
`dev`, preservando as duas citações verificáveis de blocos diferentes
e todos os gates de fonte/licença. Use testes offline + CI, e somente
depois uma revisão real supervisionada. Nenhum resultado sintético
autoriza promover alteração à MAIN automaticamente.
