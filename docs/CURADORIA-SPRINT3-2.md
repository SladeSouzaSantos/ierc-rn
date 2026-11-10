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

A prévia consulta apenas o feed público W3C/WAI, sem Redis, Strapi nem APIs de IA. O modo preview examina **120 dias** por padrão e apresenta até **6 resultados distribuídos entre fontes**; o worker real mantém **45 dias** e no máximo 3 rascunhos processados por rodada, preservando atualidade. O campo validLastYear informa quantos itens válidos existem no feed em 365 dias; withinWindow informa quantos passaram pelo filtro de recência; candidates corresponde aos que também passaram pelo tema. Não cria notícias no site.

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
- [ ] Testes finais CI e primeira prévia local confirmada.
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
