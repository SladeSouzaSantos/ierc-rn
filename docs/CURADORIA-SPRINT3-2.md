# Sprint 3.2 — Radar da Inclusão / Curadoria gratuita

**Status: primeira implementação em DEV. Não ativada automaticamente; sem publicação em PROD.**

## Arquitetura

Worker próprio Node.js 22, independente do Strapi e do Next.js. Redis 7 privado com persistência AOF mantém orçamento global e por provedor, cooldown, URLs já vistas e locks. Três horários de verificação: 08h, 13h e 19h, sempre em America/Fortaleza.

As fontes são mantidas em catálogo fechado, com a permissão de cada origem separada da capacidade de coletar títulos.

| Origem | Canal verificado | Situação |
|---|---|---|
| W3C/WAI | [RSS/Atom oficial](https://www.w3.org/WAI/feed.xml) | Elegível para síntese original e rascunho após aprovação do fluxo |
| Perkins School for the Blind | [RSS oficial](https://www.perkins.org/feed/) — publicações atuais sobre educação inclusiva, CVI e esporte adaptado | Elegível para síntese original e rascunho após aprovação do fluxo |
| RNIB | [Página pública de notícias](https://www.rnib.org.uk/news/) | **Apenas prévia de títulos/datas/links**. Termos restringem republicação; exigir autorização para qualquer reutilização |
| IBSA | [Página pública de notícias](https://ibsasport.org/news/) | **Apenas prévia de títulos/datas/links** até validar um resumo factual confiável e direitos |
| WBU | [RSS oficial](https://wbu.ngo/feed/) | Feed válido porém sem itens na inspeção, somente diagnóstico |
| ICEVI / CPB / AFB | Feeds oficiais localizados em inspeção, mas sem publicações recentes adequadas ou com conteúdos heterogêneos | Catalogação futura antes de ativação |
| CBDV | Página institucional | Feed não confirmado |

As listagens HTML são acessadas somente no modo `preview` e **não** entram no pipeline de escrita do Strapi; a prévia não replica descrições de RNIB/IBSA. O modo real percorre **exclusivamente W3C/WAI e Perkins**. A automação não rastreia artigos completos nem descarrega fotografias. Em caso de autorização negada ou conteúdo insuficiente, a origem permanece bloqueada para geração de rascunhos.

Relevância editorial: pontuação determinística por Braille/educação, goalball/paradesporto, tecnologias assistivas/baixa visão e acessibilidade; artigos sem sinal temático são ignorados. A prévia distribui resultados entre fontes por *round-robin*, com prioridade por pontuação dentro de cada origem.

## Consumo de IA — regras ORBE reaproveitadas

Ordem: **OpenRouter gratuito → Gemini gratuito confirmado → Groq gratuito confirmado → Ollama local opcional**.

- OpenRouter: somente ID de modelo openrouter/free ou terminado em :free. Qualquer rota paga é rejeitada.
- Gemini/Groq: somente se uma conta **sem faturamento ativo** e o modelo gratuito forem confirmados pelo operador; configuração exige variável FREE_TIER_CONFIRMED=true. A variável NÃO desliga cobranças no provedor — é responsabilidade do titular verificar isso. Se houver dúvida, deixe chaves vazias.
- Ollama: opção local sem cobrança por API, mas com uso de CPU, RAM e energia; URL restrita a hostname interno.
- Quota inicial: 30 tentativas globais por 24h, 10 por provedor por 24h, 4 tentativas máximas por notícia, 15s timeout por tentativa, cooldown inicial 60s até 24h.
- Quotas Redis compartilhadas entre réplicas, com reserva atômica de contador global e individual antes de cada requisição; falhas e fallbacks gastam quota. Se Redis cair, não há chamada externa.
- Fallback em HTTP 402 (crédito), 429 (rate limit), 5xx, timeout, rede e resposta inválida. 401/404 geram cooldown por configuração; 400/403/413/422 encerram a rodada por serem erros não resolvidos simplesmente mudando de modelo.
- Logs registram provedor, categoria de erro e duração, nunca chaves, prompts, respostas ou corpo das notícias.

## Fluxo editorial

1. Consultar feed Atom/RSS público e validado (domínio HTTPS autorizado, limite de 700 KB, data e relevância).
2. Normalizar URL e eliminar duplicatas, com dedupeKey SHA-256, lock Redis e consulta prévia aos rascunhos existentes no Strapi.
3. Invocar IA **somente** para notícias candidatas não vistas; fornecer título + resumo curto, jamais o artigo integral. Solicitar síntese original em português, sem afirmações não respaldadas.
4. Verificar campos estruturados, origem, idioma, data e seção "Por que isso importa para a inclusão no Brasil?".
5. Criar no Strapi com POST /api/news-articles?status=draft e editorialStatus=em_revisao. O Strapi REST publica automaticamente um POST sem status=draft, portanto esse parâmetro é obrigatório.
6. Não anexar imagens externas. Editor humano consulta a fonte, verifica tradução/fatos/direitos e decide publicar ou descartar.
7. Portal mostra conteúdo externo aprovado como **Radar da Inclusão** e mantém comunicação institucional separada.

## Prévia segura no Windows (não usa token nem IA)

Na raiz do projeto, com Node.js 22 ou superior:

    git switch dev
    git pull --ff-only origin dev
    npm install --prefix curator --no-audit --no-fund
    npm run --prefix curator test
    npm run --prefix curator preview

A prévia consulta os RSS oficiais W3C/WAI, Perkins e WBU (este último para diagnóstico), além das listagens HTML RNIB e IBSA, que permanecem **somente para prévia**, sem Redis, Strapi nem APIs de IA. O modo preview examina **120 dias** por padrão e apresenta até **6 resultados distribuídos entre fontes**; o worker real mantém **45 dias** e no máximo 3 rascunhos processados por rodada, preservando atualidade. O campo validLastYear informa quantos itens válidos existem no feed em 365 dias; withinWindow informa quantos passaram pelo filtro de recência; candidates corresponde aos que também passaram pelo tema. Não cria notícias no site.

Para simular outra janela somente na prévia, no PowerShell:

    $env:CURATOR_PREVIEW_DAYS = '180'
    npm run --prefix curator preview
    Remove-Item Env:CURATOR_PREVIEW_DAYS -ErrorAction SilentlyContinue

Ajuste opcional do número de resultados **apenas na prévia**, entre 1 e 30:

    $env:CURATOR_PREVIEW_LIMIT = '10'
    npm run --prefix curator preview
    Remove-Item Env:CURATOR_PREVIEW_LIMIT -ErrorAction SilentlyContinue

Os resultados indicam também `previewOnly: true` nas fontes que **nunca** podem ser enviadas ao Strapi por esse worker.

Uma lista vazia pode significar que a fonte não publicou material recente ou que o tema não passou no filtro; as novas contagens ajudam a distinguir essas situações.

## Preparar DEV para futura homologação (não iniciar automaticamente)

Copiar o arquivo de exemplo e guardar os segredos no computador:

    Copy-Item curator/.env.example curator/.env

O estado padrão contém CURATOR_ENABLED=false e CURATOR_WRITE_DRAFTS=false; o perfil Compose do worker chama-se curator e não sobe automaticamente.

Para testar posteriormente a agenda sem IA, alterar apenas CURATOR_ENABLED=true e manter CURATOR_WRITE_DRAFTS=false. A instância exige Docker CMS DEV e a rede ierc-rn-cms_cms_private:

    docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator up -d --build
    docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator ps

O Redis da curadoria não possui portas expostas e armazena dados em volume próprio. Não utilizar down -v ou volume prune.

## Ativação de rascunhos reais — segunda etapa, não executar agora

- Fazer backup do PostgreSQL e mídias atuais antes de atualizar a imagem CMS, pois novos campos foram adicionados ao modelo de Notícias.
- Criar no Strapi DEV um API Token **Custom** com permissão mínima de consulta e criação de Notícias, separado da chave de leitura CMS_READ_TOKEN e sem Full Access. Guardar em CURATOR_STRAPI_DRAFT_TOKEN no arquivo curator/.env.
- Configurar ao menos um provedor comprovadamente gratuito e verificar as políticas de utilização de dados desse provedor. Manter outras chaves vazias se não estiverem confirmadas.
- Somente então ativar CURATOR_WRITE_DRAFTS=true e executar uma rodada controlada (não o agendador) para gerar rascunhos em DEV.
- Conferir no Content Manager que os registros são rascunhos com editorialStatus em_revisao e publishedAt nulo. Conferir que o Next.js não os exibe antes da aprovação humana.
- Não habilitar produção até validar revisões, autorizações, segurança, backups, limites e transparência institucional.

## Verificações

- [x] Roteamento gratuito com quotas por provedor/global, cooldown e fallback com limites.
- [x] Feeds oficiais W3C/WAI + Perkins; RNIB/IBSA apenas na prévia, WBU RSS vazio; deduplicação e classificação de relevância.
- [x] Prévia sem IA e rascunhos Strapi explicitamente não publicados.
- [x] Horários 08h/13h/19h em America/Fortaleza e worker opt-in.
- [x] Conteúdo externo identificado separadamente no site.
- [x] Testes de curadoria no CI e primeira prévia local confirmada (48/48 no Windows, 10/11/2026); homologação editorial e da escrita permanece pendente.
- [x] Catálogo inicial com permissões explícitas, prévia internacional diversificada e testes de bloqueio de fontes sem autorização.
- [ ] Avaliar feeds atuais de outras instituições e autorizações de reutilização para promover novas fontes à coleta ativa.
- [ ] Homologação de falhas reais com provedores gratuitos, sem cobrança.
- [ ] Validação da criação de rascunho em Strapi DEV com permissão mínima.
- [ ] Acessibilidade do conteúdo externo aprovado e revisão editorial.
- [ ] Aprovação institucional antes de qualquer cron em produção.

Fontes técnicas: [OpenRouter free](https://openrouter.ai/collections/free-models),
[Strapi REST status](https://docs.strapi.io/cms/api/rest/status),
[Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai),
[Groq API](https://console.groq.com/docs/api-reference),
[W3C WAI Atom/RSS](https://www.w3.org/WAI/news/subscribe/).

## Diagnóstico RNIB/IBSA e WBU — 10/11/2026

As páginas RNIB e IBSA foram observadas com cards no navegador, mas a execução local pelo Node.js retornou zero. A prévia agora informa `listingDiagnostics` com contadores `detectedCards`, `invalidTitle`, `invalidLink`, `invalidDate`, `outsideWindow` e `accepted`. Esses dados não expõem texto nem URLs externas e distinguem HTML sem cards de itens reprovados pela validação. Fontes HTML seguem restritas a `previewOnly`; não tentar burlar bloqueios ou regras dos sites.

O coletor admite apenas **um redirecionamento HTTPS** mantendo domínio e caminho canônico (ex.: `/feed/` → `/feed`), rejeitando outros destinos. O RSS oficial WBU pode ser válido e não possuir nenhuma notícia — agora isso é distinguido de resposta HTML inesperada ou falha de transporte, com categorias fixas no log.

Teste local seguro: `npm run --prefix curator test` e `npm run --prefix curator preview`. Sem IA, Redis nem criação de rascunhos.


### Homologação de 46 testes e diagnóstico detalhado — 10/11/2026

A execução local no Windows com `3e66fd5` confirmou **46/46 testes**, seis resultados na prévia (W3C/WAI e Perkins), dez cartões RNIB com `invalidLink=10`, zero cartões IBSA e RSS WBU sem itens. O CI desse commit concluiu com sucesso nos três jobs; o resultado de feeds em rede ainda exige nova prévia após os ajustes seguintes.

A validação de cartões HTML agora separa falhas em contadores sem registrar URLs: `missingHref`, `malformedHref`, `relativeHref`, `unsafeScheme`, `externalHost` e `wrongArticlePath`. O parser aceita endereços relativos **somente quando resolvidos no HTTPS, hostname e prefixo de artigos já autorizados**. URLs estrangeiras, esquemas inseguros e caminhos externos à seção continuam rejeitados. Isso permite diagnosticar diferenças entre HTML do navegador e do Node.js sem revelar links ou flexibilizar publicação.

Na IBSA, um HTML que só contém o placeholder `Loading news...` é classificado como `listingState=client_render_pending`, diferentemente de `no_cards` e `cards_detected`. É um diagnóstico: **não habilitar navegador automatizado nem rota interna não autorizada para contornar a renderização dinâmica**. A fonte permanece exclusivamente `previewOnly`; nenhuma síntese do texto de origem ou cópia de imagens é realizada.

Nova homologação segura: `git pull --ff-only origin dev`, `npm run --prefix curator test` e `npm run --prefix curator preview`. Avaliar os contadores RNIB e `listingState` IBSA. Manter `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false`; `main` sem alterações.


## Homologação local concluída do diagnóstico das fontes — 10/11/2026

Evidência obtida em PowerShell no Windows com `dev=b580696` às **03:26 UTC de 10/11/2026**:

| Fonte | Últimos 365 dias | Janela de 120 dias | Candidatos temáticos | Parecer |
| --- | ---: | ---: | ---: | --- |
| W3C/WAI | 8 | 4 | 4 | RSS elegível ao processamento supervisionado, sem escrita ativada |
| Perkins | 10 | 10 | 10 | RSS elegível ao processamento supervisionado, sem escrita ativada |
| RNIB | 10 | 10 | 6 | **Diagnóstico e extração de links resolvidos**, somente `previewOnly` |
| IBSA | 0 | 0 | 0 | `client_render_pending`: a resposta inicial do cliente não contém cartões |
| WBU | 0 | 0 | 0 | RSS acessível, mas sem itens recentes identificados |

A RNIB passou de `detectedCards=10, invalidLink=10` (prévia anterior) para **`detectedCards=10, accepted=10, invalidLink=0, relativeHref=10`** na prévia de 10/11: o erro era a rejeição de links relativos, agora normalizados sem permitir saída da origem oficial. Os seis candidatos são **títulos disponíveis na prévia**, não permissão de reutilização de texto, imagem nem autorização para criação de rascunhos.

A IBSA permanece corretamente categorizada como `listingState=client_render_pending`, e a WBU não registrou falha HTTP: ambas não bloqueiam o próximo gate editorial. Não foi confirmado feed RSS oficial alternativo da IBSA nesta inspeção; não recorrer a APIs internas ou automatização de navegação sem avaliação de autorização e estabilidade.

O resultado foi `preview=true, count=6`, com dois itens selecionados de cada origem W3C/WAI, Perkins e RNIB, preservando alternância por origem e limite do lote. **Nenhuma LLM, Redis, escrita Strapi ou agenda foi acionada.**

**Validação:** `npm run --prefix curator test`: **48/48 testes locais aprovados**; [CI do commit b580696](https://github.com/SladeSouzaSantos/ierc-rn/actions/runs/42749324237) finalizado com **success**. A coleta e a prévia da Sprint 3.2 ficam tecnicamente homologadas para as fontes elegíveis e para a política de somente prévia das demais; **a Sprint 3.2 integral não está homologada para produção**.

**Próximo gate prioritário:** voltar à Sprint 3.1 no CMS DEV existente, após a atualização planejada do Strapi 5.61 e proteção dos volumes, e confirmar que o Content Manager funciona sem o erro `invalidatesTags`, com autenticação, Author/Editor, rascunho, aprovação e teste de invisibilidade pública do conteúdo pendente. Sem isso, não ativar o worker de rascunhos ou realizar merge do PR #12.


## Fase seguinte — gerar rascunho com IA gratuita sem gravar no CMS (10/11/2026)

**Objetivo retomado:** o fluxo Author/Editor e a regra de publicação do CMS já foram testados pelo operador; o foco volta à **automação editorial**. A curadoria anterior tinha teste `preview` sem IA e o caminho `once` que só invocava a IA quando a escrita estava ativada. Isso acoplava a primeira chamada real ao provedor à criação de rascunhos no Strapi e dificultava revisar a qualidade das sínteses.

Foi incluído um comando deliberadamente manual, `generate-preview`, que utiliza **o mesmo prompt e validador** do pipeline de rascunhos, mas **não instancia cliente do Strapi, não tem acesso de escrita CMS e não ativa a agenda**. É restrito ao ambiente `CURATOR_INSTANCE_KIND=dev`. Mesmo se `CURATOR_WRITE_DRAFTS=true`, este comando continua sem gravar no CMS. Somente W3C/WAI e Perkins são elegíveis, sem incorporar RNIB/IBSA/WBU às chamadas de LLM.

### Como executar uma geração real, controlada, no Windows

Primeiro garantir que a instância CMS DEV existente esteja acessível (ela já foi homologada; **não reconstruir nem reiniciar o PostgreSQL**), com o Docker Desktop em execução. Na raiz do repositório, no PowerShell:

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test

# Cria arquivo ignorado pelo Git somente se ainda não existir.
if (-not (Test-Path curator/.env)) {
  Copy-Item curator/.env.example curator/.env
}
```

Abrir **localmente** `curator/.env` e configurar apenas os valores necessários:
- `CURATOR_INSTANCE_KIND=dev`
- `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false`: **deixar desativados**
- `CURATOR_OPENROUTER_API_KEY`: chave já criada pelo operador para o plano/modelo comprovadamente gratuito; a chave jamais deve ir ao GitHub ou à conversa
- `CURATOR_OPENROUTER_MODEL=openrouter/free` (ou modelo terminado em `:free`)
- `CURATOR_AI_PREVIEW_LIMIT=1` (um rascunho original por teste; máximo 2)
- `CURATOR_AI_PREVIEW_DAYS=45` (janela conservadora; máximo 120 só para este teste)
- `CURATOR_STRAPI_DRAFT_TOKEN=` (deixar vazio nesta etapa)
- Não preencher `CURATOR_GEMINI_API_KEY` nem `CURATOR_GROQ_API_KEY` sem comprovar que a conta e modelo são gratuitos e sem cobrança; Ollama local é opcional.

```powershell
# Constrói SOMENTE a imagem descartável do worker. Não sobe o agendador.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Inicializa Redis privado para medir cotas e executa UMA única geração.
# run --rm encerra o worker após a prévia. Não publica e não cria registros.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview
```

O Compose pode iniciar automaticamente o serviço Redis (sem portas públicas), isolado do banco do Strapi. Se ainda não existir a rede externa `ierc-rn-cms_cms_private`, verificar `docker network ls` e o status da instância CMS DEV: **não modificar o nome do projeto CMS existente**. Não usar `docker compose up -d` para o worker nem executar `npm run schedule` nesse teste.

O resultado contém `aiGenerated:true`, `preview:true` e uma única entrada com `status:draft_ready`, `provider`, `originalUrl`, `draft.title`, `draft.summary`, `draft.body`, `draft.whyItMatters` e `draft.category` caso o modelo produza JSON válido. O rascunho existe **apenas na saída do terminal**, não no Strapi. `status:insufficient_evidence` significa que o modelo recusou por falta de fatos; `invalid_draft` indica formato incompleto/inseguro; `llm_unavailable` significa limite, configuração ou falha após os fallbacks gratuitos. Os logs da chamada não contêm tokens/prompt/saída de modelo; **o resultado terminal apresenta propositalmente o texto gerado** para avaliação editorial. Não compartilhar arquivos de ambiente ou segredos.

A chamada real utiliza a mesma contagem atômica Redis e os mesmos limites globais/por provedor que a futura escrita. **O modo `preview` original continua sem usar IA**; o modo `generate-preview` é explícito e consome quota gratuita, ainda que não gere rascunho válido.

### Critérios para passar da prévia de IA à escrita supervisionada

1. Produzir ao menos um `draft_ready` real de WAI/Perkins; registrar versão de modelo e categoria do provedor **sem expor a chave**.
2. Inspecionar qualidade em pt-BR, não inventar fatos, não alegar vínculo institucional nem copiar integralmente material externo. Rejeitar automaticamente JSON inválido ou `skip:true`.
3. Só após a revisão criar um token **Custom** do Strapi DEV com permissões mínimas de leitura/criação de Notícias (não o `CMS_READ_TOKEN` e nunca Full Access).
4. Executar **uma única rodada controlada** que grava **somente Draft / `em_revisao`** no Strapi DEV, comparar conteúdo com a saída, verificar `publishedAt=null`, invisibilidade no portal, dedupe Redis e ausência de imagens automáticas.
5. Avaliar fallback sob 402/429/5xx, timeout, indisponibilidade e cotas sem ativar a agenda.
6. **Somente após homologação de qualidade, permissões, acessibilidade e aprovação institucional** considerar agendamento 08h/13h/19h em DEV. Publicação para visitantes permanece exclusivamente manual.

**Status desta entrega:** implementação e testes determinísticos disponíveis em `dev`; geração com chave gratuita real no ambiente do operador ainda não executada, portanto nenhum rascunho criado nem garantia de qualidade até receber a saída do teste.


### Resultado de testes do incremento generate-preview

O job `curator-unit` do [CI #42756184288](https://github.com/SladeSouzaSantos/ierc-rn/actions/runs/42756184288) passou com **53 testes aprovados, zero falhas** (após os 48 anteriores). Cobertura adicionada:
- LLM recebe apenas título/resumo RSS das fontes aprovadas, retorna síntese validada em português; a prévia não chama cliente Strapi nem usa chaves de escrita.
- Fontes `previewOnly` são ignoradas no modo de geração por IA, mesmo quando seus títulos aparecem na prévia simples.
- Modo de IA não pode ser invocado diretamente com `dryRun=false` ou com cliente CMS fornecido.
- `{"skip":true}` não inventa um texto e termina sem forçar fallback.
- JSON de notícia incompleto, mesmo vindo de HTTP 200, provoca fallback para o próximo provedor **gratuito**, com consumo de quota e cooldown.

**Importante:** esses testes são determinísticos/mocados. A primeira geração real com OpenRouter `openrouter/free` ainda requer a chave do operador e o comando manual documentado acima; não informar sucesso de criação de notícia no CMS sem execução local.


## Correção de inicialização Redis — Docker Windows (10/11/2026)

Na primeira execução real de `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview`, o Docker criou o volume e a rede privados da curadoria, iniciou Redis `healthy` e construiu o worker Node 22 Alpine. **Nenhuma chamada à IA ocorreu nesta tentativa**: o script tentou `redis.ping()` logo após criar uma instância ioredis com `enableOfflineQueue:false`; a conexão TCP poderia estar ainda em `connecting`. O `finally` executou `redis.quit()` mesmo sem sessão pronta, ocasionando `Stream isn't writeable and enableOfflineQueue options is false` e ocultando o erro do primeiro `PING`.

**Correção no código da `dev`**: `curator/src/redis-connection.mjs` usa `lazyConnect:true`, `await redis.connect()`, confirmação de `status=ready` e `PING=PONG` antes de qualquer operação de orçamento. Caso haja falha, a conexão é descartada e as chamadas de IA permanecem bloqueadas. A rotina `closeQuotaRedis` só envia `QUIT` quando o estado é `ready`; nos demais casos usa `disconnect`; uma falha de encerramento não sobrepõe os resultados do worker. Mantivemos `enableOfflineQueue:false` e os limites de quota para não reenfileirar requisições fora de controle. Há testes de regressão simulados e um smoke de Redis 7 real no job CI `curator-unit`.

### Repetição segura do teste local

Após confirmar que o CI do commit corretivo passou, no PowerShell da raiz:

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test

# Inspeciona serviços sem alterar volumes CMS nem Redis
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator ps

# Recria somente a imagem do worker com a correção
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Uma única geração de síntese com IA gratuita; não grava no CMS
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview
```

O segundo comando pode mostrar o Redis já iniciado, e isso é normal. **Não executar `docker compose down -v`, não reiniciar o banco CMS, não habilitar o agendador e não colocar a chave de API na conversa.** O comando `generate-preview` ainda está isolado de escrita, usa apenas RSS W3C/WAI e Perkins e contabiliza toda tentativa na quota Redis.

Se houver erro de conexão após o ajuste, consultar `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator logs --tail=60 redis` (não colar segredos). Um erro `Redis is unavailable or not ready; quota enforcement blocked the AI request` significa que o trabalho parou **antes de chamar o modelo**. O resultado bem-sucedido produz `aiGenerated:true`, `status:draft_ready` e o texto gerado em pt-BR, sujeito a verificação editorial.


## Teste Docker Windows: Redis resolvido, Gemini bloqueado pela proteção de custos — 10/11/2026

O operador confirmou em PowerShell a atualização da `dev` para `0496c74`, **58/58 testes locais aprovados**, Redis 7 `healthy` e reconstrução bem-sucedida da imagem do worker. O erro anterior `Stream isn't writeable and enableOfflineQueue options is false` **não reapareceu**.

A chamada manual `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview` avançou até a validação dos provedores e falhou com:

```text
Error: gemini requires an operator-confirmed free-tier-only account
    at providersFromEnv (file:///app/src/providers.mjs:43:13)
```

**Diagnóstico:** a presença de `CURATOR_GEMINI_API_KEY` com `CURATOR_GEMINI_FREE_TIER_CONFIRMED` diferente de `true` aciona a proteção deliberada contra cobrança. Não é erro de Redis, Docker ou Strapi. A validação ocorre **antes da chamada à API LLM**; nenhum conteúdo novo foi gerado no teste.

**Procedimento imediato, sem rebuild:**

1. No arquivo privado `curator/.env`, manter a chave OpenRouter existente e `CURATOR_OPENROUTER_MODEL=openrouter/free`.
2. Deixar `CURATOR_GEMINI_API_KEY=` vazio e `CURATOR_GEMINI_FREE_TIER_CONFIRMED=false`. Fazer o mesmo para `CURATOR_GROQ_API_KEY=` e `CURATOR_GROQ_FREE_TIER_CONFIRMED=false`, a menos que já tenha verificado conta sem faturamento e modelo gratuito.
3. Preservar `CURATOR_ENABLED=false`, `CURATOR_WRITE_DRAFTS=false` e `CURATOR_STRAPI_DRAFT_TOKEN=` vazio.
4. Executar **somente** `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview`. O serviço Redis privado existente pode continuar ativo. **Não é necessário executar build novamente**, reiniciar o CMS nem remover volumes.
5. Compartilhar apenas a saída do terminal **sem segredos**. O próximo gate é uma saída `draft_ready` da LLM gratuita com fonte e texto editorial verificável.

O CI do commit `0496c74` ([workflow #42758177280](https://github.com/SladeSouzaSantos/ierc-rn/actions/runs/42758177280)) concluiu com **success**, incluindo os testes unitários e a conexão com Redis 7 real. A `main` e a automação de publicação continuam intocadas.


## Primeira chamada real OpenRouter e ajuste do Nemotron — 10/11/2026

A primeira chamada LLM real no Docker Windows **ultrapassou os bloqueios anteriores**: Redis `healthy`, fontes RSS lidas e filtros de permissão aplicados. W3C/WAI retornou 8 itens no último ano, nenhum na janela operacional de 45 dias. Perkins retornou 10 itens atuais e 10 candidatos temáticos; o item escolhido foi **“More than a game: How sport opens doors to learning and belonging for children with disabilities”**, de 05/11/2026, `relevanceScore=17`, URL oficial `https://www.perkins.org/more-than-a-game-how-sport-opens-doors-to-learning-and-belonging-for-children-with-disabilities`. RNIB/IBSA/WBU foram puladas deliberadamente por política. A resposta da única LLM configurada `nvidia/nemotron-3.5-super-vl:free` foi classificada como `invalid_output` após ~4,8 s; o modo manual retornou `llm_unavailable` e **não gravou nenhum rascunho no Strapi**.

O diagnóstico antigo **não permitia distinguir** resposta vazia, resposta truncada por `finish_reason=length`, JSON editorial inválido ou campos obrigatórios insuficientes. Não afirmar que a causa foi raciocínio sem texto: é uma hipótese, pois o modelo Nemotron 3.5 Super VL gratuito usa raciocínio por padrão e a chamada anterior enviava `max_tokens=900`. De acordo com a [documentação oficial do OpenRouter](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), os tokens de raciocínio podem consumir o orçamento completo de saída.

**Incremento na `dev`, somente código local/CI, sem chamadas externas do assistente:** a camada `router.mjs` agora gera diagnósticos seguros `token_limit`, `reasoning_without_text`, `empty_content`, `response_json`, `json_syntax`, `incomplete_draft`, `unsafe_markup`, `invalid_structure`, `schema_rejected` e `oversize_content`; os logs contêm apenas categoria fixa, provedor e duração, não o corpo, prompt, raciocínio ou chaves. Se `finish_reason=length`, nenhum texto parcialmente gerado é aceito como matéria pronta. O orçamento padrão de saída passou de 900 para **1600 tokens**, com teto de configuração de 4096 via `CURATOR_MAX_OUTPUT_TOKENS`; a solicitação ao **modelo exato** `nvidia/nemotron-3.5-super-vl:free` inclui `reasoning:{enabled:false}`, evitando que a síntese curta dependa do orçamento de raciocínio padrão. Outros modelos gratuitos mantêm parâmetros de raciocínio anteriores; `CURATOR_OPENROUTER_REASONING_ENABLED=true/false` permite configuração explícita. Nenhuma rota paga foi habilitada, e as quotas Redis permanecem inalteradas.

### Repetir a primeira geração (PowerShell)

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test

# Compilar apenas o worker; as imagens/volumes CMS DEV e Redis ficam preservados.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Uma única prévia com OpenRouter gratuito; segredos não são impressos
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run generate:preview
```

O arquivo local `curator/.env` pode continuar com o modelo NVIDIA gratuito e os limites 30 chamadas globais/10 OpenRouter (ou inferiores). Manter `CURATOR_ENABLED=false`, `CURATOR_WRITE_DRAFTS=false`, `CURATOR_STRAPI_DRAFT_TOKEN` vazio, `CURATOR_GEMINI_API_KEY` e `CURATOR_GROQ_API_KEY` vazias enquanto não houver confirmação de acesso gratuito sem faturamento. Se quiser configurar explicitamente, `CURATOR_MAX_OUTPUT_TOKENS=1600` e `CURATOR_OPENROUTER_REASONING_ENABLED=false`, mas no modelo NVIDIA acima esses valores já são defaults do novo código. Não há reset do contador de Redis: qualquer tentativa anterior consome quota, e um cooldown persistente pode gerar `llm_unavailable` temporário sem nova chamada.

**Resultado esperado para revisão de conteúdo:** `draft_ready` com campos `draft.title, draft.summary, draft.body, draft.whyItMatters, draft.category`, ou nova categoria segura no evento `llm_attempt`. Ainda **não há prova** de `draft_ready` em uma execução real; nenhum token Strapi de escrita deve ser ativado antes da análise de qualidade da notícia em pt-BR.


## Homologação da primeira notícia gerada por IA — 10/11/2026

**Evidência local:** o operador executou `git pull --ff-only origin dev` até `774e91d`, obteve **60/60 testes de curadoria aprovados**, reconstruiu a imagem do worker e realizou uma única chamada real de `generate-preview` no Docker Windows. O Redis estava `healthy`, a coleta classificou W3C/WAI (0 itens nos últimos 45 dias) e Perkins (10 candidatos) e excluiu RNIB/IBSA/WBU da geração por política. O OpenRouter respondeu em **1.960 ms**, com evento `llm_attempt.result=success`, `status=draft_ready` e `aiGenerated=true`. **Não houve POST nem criação no Strapi**, pois a execução foi `generate-preview`.

A matéria selecionada foi `More than a game: How sport opens doors to learning and belonging for children with disabilities` (Perkins, 05/11/2026). A síntese original produzida em pt-BR tem título, resumo, corpo, justificativa para inclusão e categoria `Esporte e lazer`. Os campos passaram pelo validador. A primeira falha `invalid_output` com 900 tokens deixou de ocorrer após orçamento de saída de 1600 tokens e desativação de raciocínio padrão no modelo gratuito NVIDIA. **Isso confirma o comportamento deste teste, não que o modelo produzirá sempre resultados válidos**.

**Avaliação editorial:** a publicação original da Perkins (fonte pública verificada) aborda alegria, realização, conexão, aprendizado, independência e confiança. A síntese, em linhas gerais, corresponde ao tema, mas apresentou erro `Perkins School for theBlind` e generalizações na explicação de relevância. Como o curador recebe **somente título e resumo RSS**, a confirmação de alguns detalhes na reportagem integral não significa que a IA possuía essa evidência no prompt. A revisão humana deve conferir a fonte integral, respeitar os direitos de reutilização, distinguir opinião contextual de fato demonstrado e corrigir grafia antes de qualquer publicação. O prompt foi refinado para preservar nomes próprios e evitar impactos afirmados sem suporte explícito no resumo (commit `54913fd`).

### Próximo gate: um único Draft no Strapi DEV, sem agendamento

**Preparação técnica disponibilizada na `dev`**: `CURATOR_ONCE_LIMIT=1` restringe uma execução manual `npm run once` a no máximo um item processado, sem alterar o batch agendado de até três. `CURATOR_ENABLED` e `CURATOR_WRITE_DRAFTS` continuam desativados no arquivo de configuração, e o modo `generate-preview` continua 100% somente leitura.

Antes de qualquer escrita real, completar estes requisitos:
- Inspecionar o estado do CMS DEV, sem tocar na instância PROD; backup fresco da base PostgreSQL, sem `down -v`.
- Criar um token API **Custom e temporário** no Strapi DEV com `find` e `create` apenas em Notícias, sem `publish`, `update`, `delete` ou Full Access. Guardar unicamente em `curator/.env` local.
- Confirmar `CURATOR_INSTANCE_KIND=dev` e provedor gratuito sem cobrança; preservar `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false` no arquivo.

Somente para a **rodada de homologação supervisionada**, usar o comando abaixo, que sobrepõe as flags apenas no container efêmero (o arquivo local permanece com as flags desativadas):

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test

# Não reconstruir o CMS, nem apagar volumes. Atualizar apenas o worker após mudanças em src.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Única execução de geração e escrita como Draft, com guarda de um item.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_ENABLED=true `
  -e CURATOR_WRITE_DRAFTS=true `
  -e CURATOR_ONCE_LIMIT=1 `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run once
```

**Atenção:** esse último comando **escreve** no Strapi DEV: não executá-lo até confirmar o backup recente e as permissões mínimas do token. Deve criar no máximo **um** documento com `status=draft`, `editorialStatus=em_revisao`, `aiAssisted=true` e `imageRightsStatus=pendente`. Verificar no Content Manager que `publishedAt=null`, texto correto e ausência da notícia no portal público. Após o teste, desativar ou revogar o token temporário e descartar ou manter o rascunho de teste conforme a decisão editorial. Se houver `llm_unavailable`, `invalid_draft`, `insufficient_evidence` ou `already_in_cms`, o resultado **não demonstra criação de rascunho**. Não habilitar agendamento, PROD nem publicação automática.


## Primeira escrita Strapi DEV bloqueada na consulta de duplicidade — 10/11/2026

O operador realizou backup antes de qualquer escrita com `pg_dump -Fc` no PostgreSQL DEV e `docker cp` para `cms-backups/ierc-before-curator.dump`. A cópia local foi confirmada com **245848 bytes**. Esse arquivo foi criado/copied corretamente; **restauração não foi testada**. Não sobrescrever, zerar volumes ou reiniciar o banco por causa deste erro.

Em seguida, com `dev=4801b93`, 61/61 testes locais aprovados, worker rebuild e execução manual `CURATOR_ONCE_LIMIT=1 npm run once`, o Redis estava `healthy` e os feeds W3C/WAI/Perkins foram lidos. Após validar as fontes, o cliente Strapi falhou no passo de deduplicação, **antes da LLM e antes do POST**:

```text
Error: Strapi draft lookup failed
    at cmsClient.existing (curator/src/editorial.mjs)
```

O token está presente com tamanho suficiente para passar pela validação inicial, **mas isso não comprova sua autenticidade**. O código anterior ocultava o status HTTP e não era possível distinguir 400, 401, 403, 404 ou 5xx; não presumir automaticamente que é 403. A API Strapi 5 documenta `GET /api/news-articles?status=draft` com filtros, e tokens Custom podem ter permissões restritas de `find` e `create`: [REST status](https://docs.strapi.io/cms/api/rest/status), [API tokens](https://docs.strapi.io/cms/features/api-tokens).

**Correção na `dev`**: o método `cmsClient.existing()` agora preserva **apenas** `HTTP NNN` em erros de consulta; erros de transporte e formato são categorizados sem incluir chaves, URL, corpo da resposta ou dados da notícia. Testes de regressão garantem que HTTP 403 interrompe o fluxo **antes de qualquer chamada LLM/POST** e libera o lock Redis. Foi adicionado o comando `cms:check`, que testa exclusivamente o mesmo GET privado, com uma chave de deduplicação sintética, sem IA, sem Redis, sem publicação e sem escrita.

### Diagnóstico antes de tentar criar um Draft novamente

No PowerShell, partindo da raiz:

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test

# Reconstrói apenas a imagem do curador. Não recria CMS/Redis.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Verifica somente consulta de rascunhos; não usa IA ou Redis:
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run cms:check
```

A saída segura é `{"event":"cms_draft_lookup_check","status":"ok","readOnly":true}` quando a consulta autenticada responde com corpo válido. Em erro, o programa informa somente `httpStatus` e uma categoria fixa. Interpretação:

| Código | Próxima ação |
| --- | --- |
| 401 / authentication | Conferir se o token Content API foi copiado integralmente para `CURATOR_STRAPI_DRAFT_TOKEN` no `curator/.env` privado, sem espaços/aspas e sem estar expirado; regenerar se necessário |
| 403 / permission | No Strapi DEV em `Settings > Global settings > API Tokens`, conferir token **Custom** com permissão `find` para `news-article` (Notícias), além de `create`; não habilitar Public nem Full Access |
| 400 / invalid_query | Conferir se a API do CMS DEV atual expõe o campo `dedupeKey` e aceita `status=draft` com os filtros usados; revisar logs sanitizados do CMS; não conceder permissões extras |
| 404 / endpoint_missing | Conferir rede do worker, rota `/api/news-articles` e instância CMS DEV correta |
| 5xx / cms_server_error | Investigar logs do CMS e seu estado sem resetar dados |
| connection_or_configuration | Conferir rede Docker `cms_dev_private` e `cms` `healthy`, sem mover o CMS para URL pública |

**Se `cms:check` passar**, executar **somente uma vez** o comando supervisionado `run --rm -T -e CURATOR_ENABLED=true -e CURATOR_WRITE_DRAFTS=true -e CURATOR_ONCE_LIMIT=1 -e CURATOR_GEMINI_API_KEY= -e CURATOR_GROQ_API_KEY= worker npm run once` já documentado na seção anterior. A execução só cria Draft; deve-se conferir `status=draft`, `editorialStatus=em_revisao`, `publishedAt=null` e ausência pública. Não ativar cron, publicar conteúdo automaticamente ou copiar chaves para relatórios.


## Diagnóstico por parâmetro após HTTP 400 no Strapi DEV — 10/11/2026

O operador mostrou o painel **Settings > API Tokens** com token **Custom** chamado `ierc-curator-dev-drafts`; em **News-article** somente `find` e `create` estão marcados, enquanto `findOne`, `update` e `delete` aparecem desmarcados. A imagem confirma a seleção visível, mas **não comprova que a última alteração foi salva no backend**. O campo `Token duration` aparece em `Select`, com legenda `Expiration date: Unlimited`; recomenda-se selecionar duração limitada (se disponível) e salvar as permissões.

A prova Windows em `dev=5ce9f26` concluiu **66/66 testes locais**, rebuild do worker e `npm run cms:check`. A execução respondeu `{"event":"cms_draft_lookup_check","status":"failed","category":"invalid_query","httpStatus":400,"readOnly":true}`. O token passou pela validação inicial, mas não é possível inferir seu escopo efetivo só com isso. Um HTTP 400 indica rejeição de um parâmetro, dado ou validação da solicitação; não conceder Full Access nem permissões de atualização/exclusão para contornar.

**Incremento `dev`**: o comando `cms:check`, apenas quando o GET completo recebe HTTP 400, realiza uma sequência adicional de cinco **GETs privados** com o mesmo token, e registra apenas `step`, `httpStatus` e `responseValid`: (1) `collection` sem parâmetro, (2) `draft_status`, (3) `pagination`, (4) `dedupe_filter` e (5) `combined`. São consultas sem criação de notícias, sem Redis e sem chamadas à IA. Não imprimem token, headers, URL ou conteúdo. Caso algum probe devolva 401/403, a sequência para. Testes de integração simulam um campo de filtro recusado e validam que todas as solicitações são GET.

Se `dedupe_filter` e `combined` falharem com 400, enquanto `collection`, `draft_status` e `pagination` passarem, conferir se o **schema realmente em execução no contêiner CMS DEV** contém `dedupeKey` (definido em `cms/schemas.mjs`). Não confundir arquivo versionado com schema montado no contêiner. Se `draft_status` falhar isoladamente, verificar middleware/configuração de consulta e versão do Strapi; se `pagination` falhar, inspecionar validação de parâmetros. Não recriar banco nem alterar permissões preventivamente.

No PowerShell, atualizar apenas `dev` e a imagem do **worker**, depois executar `cms:check`:

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator test
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run cms:check
```

**Não executar `npm run once` ainda**. Somente após identificar o parâmetro rejeitado corrigir a causa, repetir `cms:check` e confirmar `status=ok` antes de permitir uma única criação Draft DEV. Preservar backup de 245848 bytes, PostgreSQL DEV, `main`, PR #12 Draft e agendador desligado.

Referências: [Strapi 5 filtros](https://docs.strapi.io/cms/api/rest/filters), [status draft](https://docs.strapi.io/cms/api/rest/status), [validação de entrada](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/default-input-validation).
