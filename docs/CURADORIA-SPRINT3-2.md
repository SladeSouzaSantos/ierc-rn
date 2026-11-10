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


## Diagnóstico confirmado: dedupeKey ausente no Strapi em execução — 10/11/2026

**Evidência real de Windows, `dev=862db90`:** 68/68 testes locais aprovados; imagem do curador recompilada. A execução de `cms:check` obteve `HTTP 200` em `collection`, `draft_status` e `pagination`, mas `HTTP 400` em `dedupe_filter` e `combined`. O teste somente leitura do schema do contêiner CMS confirmou `{"draftAndPublish":true,"dedupeKeyPresent":false}`. A definição versionada `cms/schemas.mjs` **já inclui** `news-article.attributes.dedupeKey` (`string,unique:true`); portanto, existe divergência real entre imagem CMS em execução e definição da branch `dev`. Não alterar o filtro do curador nem habilitar `Full Access`: isso eliminaria a deduplicação e não corrigiria a ausência da coluna/campo.

**Precaução necessária:** em Strapi 5, o startup sincroniza o schema e pode remover tabelas e colunas que deixaram de existir no código. Veja [documentação oficial sobre migrations](https://docs.strapi.io/cms/database-migrations) e [configuração de banco](https://docs.strapi.io/cms/configurations/database). Existe backup recente `cms-backups/ierc-before-curator.dump` (245848 bytes), com cópia confirmada, mas **restauração não testada**. Não executar `docker compose down -v`, não reconstruir PostgreSQL e não reiniciar o CMS às cegas.

### Gate de comparação antes de atualizar o contêiner CMS DEV

A `dev` disponibiliza o utilitário **somente leitura** `cms/scripts/check-deployed-schema.mjs`: recebe por stdin uma cópia dos JSON schemas instalados no contêiner, compara com `cms/schemas.mjs` na branch atual e retorna apenas uma lista de `additions` e `hazards`, sem dados pessoais, tokens ou acessos SQL. Execute da raiz no PowerShell, sem reiniciar serviços:

```powershell
git switch dev
git pull --ff-only origin dev
node --test cms/tests/deployed-schema-diff.test.cjs

# Inspeciona unicamente a definicao dos content types da imagem CMS atual.
docker compose --env-file cms/.env -f compose.cms.yml exec -T cms node -e "const fs=require('fs'); const base='/opt/app/src/api'; const data={}; for(const name of fs.readdirSync(base)){const path=base+'/'+name+'/content-types/'+name+'/schema.json'; if(fs.existsSync(path))data[name]=JSON.parse(fs.readFileSync(path,'utf8'));} process.stdout.write(JSON.stringify(data));" | node cms/scripts/check-deployed-schema.mjs
```

Saída de exemplo para uma divergência **exclusivamente aditiva**:

```json
{"status":"additions_only","additions":[{"model":"news-article","field":"dedupeKey","type":"string"}],"hazards":[],"readOnly":true,"databaseSchemaNotChecked":true}
```

Se houver `hazards`, **não reiniciar o Strapi**: investigar os modelos afetados e avaliar uma migração que preserve conteúdo. Se houver somente `additions_only`, ainda é necessário revisar as alterações e confirmar o backup e os registros existentes, pois **esse utilitário compara schemas do código, não inspeciona todo o catálogo PostgreSQL ou garante que a sincronização não terá efeitos colaterais**. A aprovação de um deploy CMS fica condicionada à inspeção dessas diferenças.

Após aprovar o delta aditivo, o caminho previsto será compilar somente `cms` e recriar somente o serviço `cms` com `--no-deps`, preservando `db` e volumes, confirmar `dedupeKeyPresent:true` e executar `cms:check` novamente. Só com `status=ok` poderá ocorrer a rodada supervisionada `once` que cria **um único Draft**, sem agenda/publicação automática.

`main` e PR #12 Draft permanecem intactos; Redis e worker não precisam de nova modificação por este erro.


## PowerShell: corrigir invalid_snapshot sem reiniciar o CMS — 10/11/2026

O operador atualizou `dev=7743187` e executou os **3 testes determinísticos do comparador com sucesso**. Entretanto, o comando que transmite os schemas do `docker compose exec -T cms node -e ...` para `node cms/scripts/check-deployed-schema.mjs` via pipe no PowerShell retornou `{"status":"invalid_snapshot","readOnly":true}`. **A comparação não foi executada**, portanto a saída não implica `hazards` nem `additions_only`. A origem precisa da corrupção/ausência de JSON no pipeline não foi comprovada (possibilidades: transcodificação do PowerShell, stdout não-JSON ou comando Docker). Não reiniciar o Strapi ou mexer no banco com base nesse resultado.

**Novo método mais confiável no Windows (arquivo a arquivo, sem pipeline de JSON):** `cms/scripts/check-deployed-schema.mjs --schema-root <pasta>/api` lê somente os `schema.json` do diretório copiado do contêiner, compara-os contra `cms/schemas.mjs` e mantém a rejeição de mudanças destrutivas. Há testes para delta apenas aditivo, schema alterado, diretório vazio e stdin UTF-8 BOM. A alternativa antiga de stdin segue funcionando em Linux/scripts; **prefira o modo diretório no PowerShell**.

Na raiz do repositório:

```powershell
git switch dev
git pull --ff-only origin dev
node --test cms/tests/deployed-schema-diff.test.cjs

# Obtém a instância DEV em execução, sem alterar ou recriar contêineres.
$cmsId = docker compose --env-file cms/.env -f compose.cms.yml ps -q cms
if (-not $cmsId) { throw "Contêiner CMS DEV não encontrado" }

# Cópia temporária, fora do repositório; preserva arquivos JSON originais.
$snapshotRoot = Join-Path $env:TEMP ("ierc-cms-schema-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $snapshotRoot | Out-Null
docker cp "${cmsId}:/opt/app/src/api" "$snapshotRoot"
if ($LASTEXITCODE -ne 0) { throw "Falha ao copiar schemas do CMS DEV" }

# Nenhuma query SQL, nenhuma escrita, nenhuma publicação.
node cms/scripts/check-deployed-schema.mjs --schema-root (Join-Path $snapshotRoot "api")
```

Esperado: JSON com `status`, `additions`, `hazards`, `readOnly:true` e `databaseSchemaNotChecked:true`. O script retornará código 0 em `additions_only`, 3 em `manual_review_required` e 2 em `invalid_snapshot`; o código 0 **não é aprovação automática de migração PostgreSQL**. Caso haja apenas `dedupeKey` em `additions`, ainda exigimos a revisão do delta antes de reconstruir somente o serviço `cms`. Caso haja `hazards` ou `invalid_snapshot`, parar sem reiniciar o CMS. O dump anterior de **245848 bytes** permanece preservado, sem restauração ensaiada.

Não executar `npm run once` nem ativar `CURATOR_ENABLED`/`CURATOR_WRITE_DRAFTS` ou qualquer publicação até o schema DEV ser corrigido e `cms:check` retornar `status=ok`.


## Delta real de schemas validado: nove adições em news-article (10/11/2026)

O operador atualizou `dev` para `a0d6ff2`, executou **7/7 testes** de `cms/tests/deployed-schema-diff.test.cjs`, copiou com êxito aproximadamente 61 kB de `/opt/app/src/api` do contêiner CMS DEV em execução para pasta temporária Windows usando `docker cp` e executou `check-deployed-schema.mjs --schema-root`.

**Relatório real:**
```json
{"status":"additions_only","additions":[{"model":"news-article","field":"originType","type":"enumeration"},{"model":"news-article","field":"scope","type":"enumeration"},{"model":"news-article","field":"country","type":"string"},{"model":"news-article","field":"sourceLanguage","type":"string"},{"model":"news-article","field":"originalTitle","type":"string"},{"model":"news-article","field":"originalPublishedAt","type":"datetime"},{"model":"news-article","field":"whyItMatters","type":"text"},{"model":"news-article","field":"aiAssisted","type":"boolean"},{"model":"news-article","field":"dedupeKey","type":"string"}],"hazards":[],"readOnly":true,"databaseSchemaNotChecked":true}
```

**Interpretação:** os schemas implantados têm só **nove campos pendentes de adição**, todos em `news-article`; nenhum campo removido, modificado ou content-type ausente detectado. Os campos são de origem/rastreabilidade, transparência IA, justificativa e deduplicação. O comparador **não inspecionou o esquema físico PostgreSQL nem os registros**; ainda não há aprovação para executar sincronização do CMS.

**Tokens separados:** na raiz o operador mantém `.env.local` com `CMS_ENABLED=true`, `CMS_API_URL=http://127.0.0.1:1337` e `CMS_READ_TOKEN` (valor mascarado no relato). Este token é do **portal Next.js para leitura** e **não deve ser reutilizado** como `CURATOR_STRAPI_DRAFT_TOKEN`, que fica exclusivamente em `curator/.env` com `find/create` em Notícias. Preservar também `cms/.env` e seus segredos de autenticação Strapi para não invalidar tokens existentes.

### Inspeção física PostgreSQL somente leitura antes de rebuild do CMS

Na raiz, no PowerShell, sem modificar volumes, executar os comandos em linhas separadas:

```powershell
# Verificar nome real da tabela e colunas atuais.
docker compose --env-file cms/.env -f compose.cms.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U ierc_cms -d ierc_cms -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='ierc_news_articles';"
docker compose --env-file cms/.env -f compose.cms.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U ierc_cms -d ierc_cms -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='ierc_news_articles' ORDER BY ordinal_position;"
docker compose --env-file cms/.env -f compose.cms.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U ierc_cms -d ierc_cms -c "SELECT COUNT(*) AS total_news_rows FROM public.ierc_news_articles;"
```

**Esses SELECTs não modificam o banco e não imprimem valores das notícias, tokens ou dados pessoais.** Conferir se a tabela existe, o volume de linhas atuais e se os nove campos já estão ou não fisicamente instalados. Caso a tabela não exista ou surja divergência inesperada, não reconstruir o CMS até investigar.

**Depois** da inspeção física, confirmar o backup `cms-backups/ierc-before-curator.dump` (245848 bytes, restore ainda não testado), avaliar o risco de sincronização automática Strapi 5 e decidir o deploy de **somente** `cms` (`docker compose ... build cms` e `up -d --no-deps cms`, sem subir novamente o `db` e sem apagar volumes). Em Strapi 5 a sincronização de schema na inicialização pode remover objetos não presentes no content-type; documentação oficial: https://docs.strapi.io/cms/database-migrations e https://docs.strapi.io/cms/configurations/database. Não habilitar `forceMigration:false` de forma ad hoc, pois afeta o rastreamento de objetos removidos; não alterar configuração sem análise.

Após eventual deploy, verificar `dedupeKeyPresent:true`, conferir contagem e conteúdo existente no Content Manager, `npm run cms:check` com status `ok` e **somente depois** permitir uma única criação `Draft` supervisionada, sem cron ou publicação automática.

**Estado:** `main` intocada, PR #12 Draft, `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false` persistidos; nenhum novo rascunho gerado no CMS nesta etapa.


## Inspeção física PostgreSQL concluída: tabela intacta, dois registros — 10/11/2026

O operador executou as três consultas **somente leitura** no Postgres 17 DEV e confirmou:
- `public.ierc_news_articles` existe.
- Contém **23 colunas**, incluindo `document_id`, `published_at`, `editorial_status` e dados atuais de notícias. **Não possui nenhum dos nove novos campos** de origem/rastreabilidade/IA/deduplicação.
- Contém **2 registros físicos** antes do deploy, `SELECT COUNT(*) = 2`. Não interpretar como duas notícias distintas: o Strapi 5 pode manter versões draft/published para um documento.
- A comparação anterior de schemas de aplicação retornou `additions_only` com nove adições exclusivamente em `news-article`, `hazards=[]`. A inspeção de tabela física é compatível com esse delta. Ainda não foi auditado o catálogo completo de constraints e tabelas auxiliares.
- O backup `cms-backups/ierc-before-curator.dump` tem 245848 bytes e foi copiado com sucesso. **Restaurabilidade ainda não ensaiada**.

O usuário também confirmou `.env.local` da raiz com `CMS_ENABLED=true`, `CMS_API_URL=http://127.0.0.1:1337` e `CMS_READ_TOKEN`: esse token é **somente para o portal ler conteúdo**. O token Custom `CURATOR_STRAPI_DRAFT_TOKEN` no `curator/.env` é independente, com `find/create` em Notícias.

### Atualização controlada somente do serviço CMS DEV

Verificar a listagem do dump de backup sem restaurar ou alterar dados:
```powershell
docker compose --env-file cms/.env -f compose.cms.yml exec -T db pg_restore -l /tmp/ierc-before-curator.dump > $null
if ($LASTEXITCODE -ne 0) { throw "Dump PostgreSQL nao pode ser listado; nao fazer deploy" }
Get-Item .\cms-backups\ierc-before-curator.dump | Select-Object Name, Length

# Construir imagem nova, sem reiniciar/alterar banco.
docker compose --env-file cms/.env -f compose.cms.yml build cms
if ($LASTEXITCODE -ne 0) { throw "Build CMS falhou; nao fazer deploy" }
```

**Observação:** `pg_restore -l` apenas valida a leitura do catálogo do arquivo, não prova a restauração completa. Se o `cms` tiver alterações pendentes no Content Manager ou o backup não corresponder ao banco atual, verificar antes de prosseguir.

Após validar gates e confirmar que a sincronização automática do Strapi 5 poderá ser aplicada a este DEV, recriar **somente** o CMS, sem subir dependências, sem `down` nem `-v`:

```powershell
docker compose --env-file cms/.env -f compose.cms.yml up -d --no-deps cms
if ($LASTEXITCODE -ne 0) { throw "Deploy CMS falhou; nao executar curador" }

docker compose --env-file cms/.env -f compose.cms.yml ps
```

O Strapi sincroniza schema no startup e, com `forceMigration` padrão, pode remover objetos não declarados; mesmo que o diff de content-types seja aditivo, essa operação **escreve no PostgreSQL** e deve ser tratada como migração DEV supervisionada. Referência oficial: https://docs.strapi.io/cms/configurations/database.

Validar **depois do deploy**, sem imprimir títulos de notícias ou segredos:

```powershell
docker compose --env-file cms/.env -f compose.cms.yml exec -T cms node -e "const s=require('/opt/app/src/api/news-article/content-types/news-article/schema.json'); console.log(JSON.stringify({draftAndPublish:s.options.draftAndPublish,dedupeKeyPresent:Object.hasOwn(s.attributes,'dedupeKey')}))"

docker compose --env-file cms/.env -f compose.cms.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U ierc_cms -d ierc_cms -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ierc_news_articles' AND column_name IN ('origin_type','scope','country','source_language','original_title','original_published_at','why_it_matters','ai_assisted','dedupe_key') ORDER BY column_name;"

docker compose --env-file cms/.env -f compose.cms.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U ierc_cms -d ierc_cms -c "SELECT COUNT(*) AS total_news_rows FROM public.ierc_news_articles;"
```

Esperado: `dedupeKeyPresent=true`, **nove colunas novas**, `total_news_rows=2` antes da execução do curador; confirmar também notícias existentes no Content Manager e login/admin sem regressão. Se algum item divergir, **não executar o curador**; diagnosticar logs do CMS e preservar backup/volumes, sem reset.

Somente após esses gates, executar no worker já construído:
```powershell
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run cms:check
```

O resultado obrigatório é `{"event":"cms_draft_lookup_check","status":"ok","readOnly":true}`. A partir daí, com revisão humana e backup preservado, retomar a única escrita supervisionada como **Draft** (limite `CURATOR_ONCE_LIMIT=1`) já documentada acima. Agendador, PROD, `main` e PR #12 continuam inativos/intocados.


## Migração aditiva CMS DEV concluída e consulta do curador aprovada — 10/11/2026

**Evidência da execução Windows do operador:**
- Backup local `cms-backups/ierc-before-curator.dump` conferido com **245848 bytes**; `pg_restore -l /tmp/ierc-before-curator.dump` terminou com código 0. **Ainda não é um teste de restauração**.
- `docker compose --env-file cms/.env -f compose.cms.yml build cms` completou; `up -d --no-deps cms` recriou somente o CMS DEV. `cms` e PostgreSQL 17 (`db`) aparecem `healthy`; o contêiner DB mantinha 13h de funcionamento.
- Schema dentro do novo contêiner reportou `dedupeKeyPresent=true`. Inspeção `information_schema.columns` confirmou **9 colunas adicionadas** à `public.ierc_news_articles`: `origin_type`, `scope`, `country`, `source_language`, `original_title`, `original_published_at`, `why_it_matters`, `ai_assisted` e `dedupe_key`.
- `COUNT(*)` na tabela Notícias permaneceu **2 linhas antes e depois** do deploy (são versões físicas, não necessariamente dois documentos distintos). O operador ainda deve verificar os dois registros no Content Manager e o funcionamento do login/admin, pois contagens não provam integridade semântica.
- `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run cms:check` retornou **`{"event":"cms_draft_lookup_check","status":"ok","readOnly":true}`**. A autenticação e a consulta com `status=draft`, filtro `dedupeKey` e paginação estão funcionais. **O antigo HTTP 400 foi resolvido.**
- Nenhuma chamada LLM ou POST de notícia foi realizada nesta etapa.

**Gate concluído:** sincronização aditiva do schema CMS DEV e consulta de deduplicação do curador homologadas. **Gate pendente:** criação de um único Draft real via IA com avaliação humana. O token `CMS_READ_TOKEN` em `.env.local` permanece exclusivamente para o Next.js. A chave Custom com `find/create` para Notícias permanece em `CURATOR_STRAPI_DRAFT_TOKEN` privado, distinta da de leitura do portal.

### Homologação seguinte: um Draft supervisionado, sem agendamento

No navegador, confirmar que os conteúdos anteriores estão visíveis no Content Manager DEV e que não há trabalho editorial em curso. Preservar o dump de backup e as flags em disco `CURATOR_ENABLED=false`, `CURATOR_WRITE_DRAFTS=false`; somente uma execução manual com overrides efêmeros:

```powershell
# Um único lote de um item; não inicia schedule.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_ENABLED=true `
  -e CURATOR_WRITE_DRAFTS=true `
  -e CURATOR_ONCE_LIMIT=1 `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run once
```

O POST do worker **inclui explicitamente `?status=draft`** conforme a [documentação oficial do Strapi 5](https://docs.strapi.io/cms/api/rest/status), exigindo `publishedAt=null` na resposta antes de registrar `draft_created`. Confirmar no Content Manager que o novo documento tem `editorialStatus=em_revisao`, `aiAssisted=true`, `imageRightsStatus=pendente`, `publishedAt=null` e não está visível para visitantes do portal. **Não considerar `draft_created` sem essa validação**, não ativar cron, não publicar conteúdo automaticamente e revogar o token temporário após a homologação. Se a geração LLM falhar, o status poderá ser `llm_unavailable` sem escrita; se ocorrer 400/403 no POST, investigar permissões/atributos sem aumentar para Full Access.

A branch `main`, PR #12 Draft, publicação automática e instância PROD permanecem inalteradas.


## Primeiro Draft de IA criado no Strapi DEV — 10/11/2026

**Evidência da primeira escrita real**, fornecida pelo operador:
- Execução manual `docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T -e CURATOR_ENABLED=true -e CURATOR_WRITE_DRAFTS=true -e CURATOR_ONCE_LIMIT=1 -e CURATOR_GEMINI_API_KEY= -e CURATOR_GROQ_API_KEY= worker npm run once` em Docker Windows. As duas flags de escrita foram passadas **apenas ao container efêmero**, não configuradas permanentemente.
- Redis `healthy`; W3C/WAI sem candidatos dentro dos 45 dias, Perkins com 10 candidatos elegíveis; RNIB, IBSA e WBU excluídas conforme política.
- `llm_attempt` retornou **OpenRouter success** em **2740 ms**. `draft_created` registrado com somente hash do `documentId`, sem expor ID completo, token nem artigo. Sumário: `{"results":[{"source":"perkins","status":"draft_created"}],"preview":false,"aiGenerated":false,"count":1}`.
- O SQL executado **depois** do worker confirmou `SELECT COUNT(*) ... WHERE ai_assisted IS TRUE AND editorial_status='em_revisao' AND published_at IS NULL` = **1**. Há, portanto, um rascunho em revisão assistido por IA, não publicado.
- O código do cliente envia `POST /api/news-articles?status=draft` e valida `publishedAt:null` na resposta antes de registrar o evento de sucesso. A prova SQL confirma o estado no banco. **A ausência da notícia no portal público e a qualidade do conteúdo ainda exigem verificação editorial manual.**
- **Bug de relatório identificado e corrigido na `dev`**: `aiGenerated:false` no resumo não representa que não houve geração; `runOnce` usava `aiPreview` (seletor de modo) para esse campo, causando falso negativo no modo `once`. O novo cálculo retorna `true` quando algum resultado é `draft_ready` ou `draft_created`, `false` no preview lexical, em `seen`, `llm_unavailable` ou `insufficient_evidence`. Commits `75bda43` (código) e `ea4a7e2` (testes); **o resultado antigo do terminal não muda retroativamente**, e **não é necessário repetir a escrita para validar essa correção**.

**Status do gate:** ingestão real de **um único Draft IA no Strapi DEV concluída**; revisão editorial e checagem visual no Content Manager ainda pendentes. Antes de considerar pronto para agendamento, abrir a notícia no painel e verificar título/ortografia, corpo, fidelidade aos fatos fornecidos pelo RSS, URL da fonte, classificação, `em_revisao`, imagem ausente ou autorizada, publicação ausente e invisibilidade na página pública. Se encontrar problemas, editar ou descartar o rascunho; não habilitar schedule/PROD/publicação automática. A decisão sobre cron e autorizações de fontes permanece manual.

O backup `cms-backups/ierc-before-curator.dump` (245848 bytes) é **pré-migração** e teve catálogo legível, sem restauração ensaiada. Recomendável criar um backup **pós-migração** depois que a notícia for revisada, preservando o backup anterior, antes de qualquer expansão do fluxo. **Não reinicializar volumes ou reutilizar o token de leitura do Next.js para escrita.** Se o token Custom foi emitido apenas para homologação, revogar/expirar após a conferência.


## Revisão visual do primeiro Draft: escrita homologada, duas correções editoriais — 10/11/2026

O operador apresentou capturas do **Content Manager > Notícias** do Strapi DEV e da página **Notícias** do portal. A notícia criada com IA aparece com selo **Draft**, editor exibe `editorialStatus=em_revisao`, `aiAssisted=true`, `imageRightsStatus=pendente`, imagem vazia, `sourceName=Perkins School for the Blind`, URL de origem, `originType=externa`, `scope=internacional`, `country=Estados Unidos`, `sourceLanguage=en`, título original, data de origem e `dedupeKey`. O portal exibido mantém somente os cards de fontes externas conhecidos e **não mostra a notícia de IA ainda não aprovada**. A ausência na captura é evidência visual favorável, mas não equivale a uma varredura de todos os endpoints.

**Qualidade textual: aprovação técnica, revisão editorial necessária antes de Publish.** O rascunho tem título adequado, resumo objetivo e atribuição correta, mas duas passagens extrapolam a evidência disponível ao gerador:
1. No corpo, declara que a publicação original não detalha modalidades, programas ou resultados; entretanto a [reportagem completa](https://www.perkins.org/more-than-a-game-how-sport-opens-doors-to-learning-and-belonging-for-children-with-disabilities/) apresenta natação, caminhadas, jogos inclusivos, atuação na Indonésia e experiências de crianças e famílias.
2. No `whyItMatters`, sugere que a fonte não apresenta evidências concretas de impacto; o artigo cita pesquisas e experiências observadas. Não confundir **informações ausentes do resumo RSS** com **ausência desses fatos na reportagem completa**. O gerador recebeu só título e resumo do feed; portanto, a correção humana deve consultar o artigo e atribuir adequadamente suas informações. Uma revisão escrita a partir do artigo pode ser mais rica que o resumo automático, mantendo originalidade e link de crédito. Não reutilizar imagens da Perkins sem autorização.

**Melhoria preventiva na `dev`** (não retroativa): `curator/src/editorial.mjs` agora instrui explicitamente a LLM a **não alegar que a reportagem não contém modalidades, estudos ou resultados apenas porque o RSS não os informou**, e a usar `skip:true` quando título e resumo forem insuficientes. Teste de contrato do prompt adicionado. Isso não é garantia de cumprimento em saídas probabilísticas; a aprovação editorial humana continua obrigatória. Não reexecutar `npm run once` para corrigir o Draft existente; editar no Content Manager, manter `Draft` e salvar.

**Melhorias futuras não bloqueantes:** padronizar categoria `esporte`/ `esporte adaptado` com taxonomia editorial. A data `11/05/2026` exibida pelo Admin pode estar em convenção norte-americana (**5 de novembro de 2026**); verificar formatação de locale no painel antes de interpretar como 11 de maio. Criar uma seção separada **Radar da Inclusão** para histórias externas com créditos e links, sem apresentá-las como notícias institucionais próprias. Nenhuma dessas alterações foi feita nesta revisão.

**Próximo gate:** revisar o texto do Draft, salvar sem publicar, inspecionar a fonte/atribuição, verificar não-exibição no portal e confirmar decisão editorial. Manter `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false` nos arquivos, sem schedule/PROD ou merge `dev`→`main` enquanto a homologação de conteúdo não for concluída.
