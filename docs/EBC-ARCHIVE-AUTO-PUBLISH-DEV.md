# IERC-RN — descoberta complementar EBC no worker IA (DEV)

Data: 11/11/2026. Branch: dev. Produção e PR #12 Draft intocados.

## Evidência real usada no gate

No MiniMac, commit cf37b38, o diagnóstico independente
node src/check-ebc-archive.mjs --section=educacao --pages=2 --max-evidence=2
confirmou 23 itens oficiais (9 na página 0, 14 na página 1), zero URLs
rejeitadas, 2 candidatas lidas integralmente e 1 com evidência direta de
deficiência visual. A matéria sobre novas regras de acessibilidade no
Enem em 08/11/2026 foi classificada
visual_evidence_verified_for_review; a matéria sobre aprendizagem
geral de alunos com deficiência ficou visual_evidence_not_found.
Ambas passaram na verificação de autoria e direito de uso individual.
O comando era estritamente read-only e NÃO publicou.

## Incremento adicionado ao worker de autopublicação EXISTENTE

- Arquivo curator/src/ebc-archive-worker.mjs: coleta de até 2 páginas
  oficiais de uma ÚNICA editoria aprovada, Educacao. Valida HTTPS, domínio,
  caminho e data (45 dias), deduplica URLs, permite no máximo duas
  leituras integrais de candidatas com pista lexical.
- Para chegar à etapa editorial, a reportagem exige:
  artigo integral extraído; autoria genuína da Agência Brasil;
  direitos da própria matéria verificados; licença e origem idênticas
  às do catálogo; e evidência de deficiência visual no corpo, não apenas
  no título. O corpo é descartado da síntese de descoberta e só
  permanece como evidência transitória para os prompts da IA.
- Reutiliza a MESMA função processArticle de curator/src/editorial.mjs.
  Portanto, usa lock e deduplicação Redis/Strapi, geração de resumo
  original por IA, revisor independente, registro de auditoria,
  tokens distintos de rascunho e publicação, e até UMA publicação
  por janela. Não há novo worker, container, cron nem aumento da quota.
- Quando a flag está ON, requisições ao host EBC dentro do ciclo
  (RSS, listagens públicas, reportagem integral) respeitam intervalo
  mínimo de 10 segundos, conforme robots.txt público.
  A execução pode ser mais demorada; a agenda é controlada por slot
  Redis e não deve gerar duas publicações no mesmo horário.
- A descoberta paginada só está autorizada na editoria Educação.
  Direitos Humanos, Esportes e Internacional permanecem no RSS
  publicado até homologação equivalente das suas listagens.
  Justiça, Política, Saúde e Geral permanecem apenas previewOnly.
- Falha de disponibilidade na listagem registra diagnóstico sanitizado
  e mantém o caminho RSS antigo. Uma reportagem não passa para IA se
  não superar o gate de evidências e direitos do artigo individual.
- O diagnóstico CLI do monitor permanece read-only. A nova integração
  só pode executar via worker dev e chave explícita.

## Gate de ativação (sem expor credenciais)

A flag NOVA CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED=false está documentada em
curator/.env.example, é OFF quando ausente e NÃO modifica o arquivo real.
Ela só pode ser TRUE com:
  CURATOR_INSTANCE_KIND=dev
  CURATOR_ENABLED=true
  CURATOR_WRITE_DRAFTS=true
  CURATOR_AUTO_PUBLISH_ENABLED=true
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true
  CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES contendo agencia-brasil-educacao
  tokens Strapi de Draft e Publish distintos e ativos.

A validação da flag ocorre ANTES de Redis, LLM ou Strapi.
Se houver ausência de autorização, o worker falha antes de agir.

Operação segura no MiniMac DEV, somente após CI aprovado:

~~~bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
git rev-parse --short HEAD

# Confirme que o projeto existente, worker e Redis estão saudáveis.
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator ps

# A flag é definida manualmente no arquivo privado real curator/.env.
# Não imprimir nem compartilhar chaves de API ou Strapi.
# Depois do opt-in, recriar SOMENTE o worker existente; manter Redis+volume.
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator up -d --build --no-deps worker

docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator logs --tail=100 worker
~~~

NÃO rodar docker compose down -v; NÃO iniciar outro projeto Compose nem
novo worker; NÃO alterar main, PROD ou Strapi. Durante a inicialização,
verificar schedule_started.archiveDiscovery=true,
autoPublish=true, e os horários ["08","13","19"].
O worker continuará executando três vezes por dia.
O incremento NÃO publica notícia ao ser construído: só atua
na próxima execução autorizada, enquanto houver candidato elegível.

## Critérios de homologação de primeira publicação real

1. Logs archive_page_checked e archive_candidate_verified mostram
   a categoria Education com candidato real e direitos individuais.
2. O primeiro resultado de geração por IA foi aceito pelo validador.
3. O segundo provedor/revisor independente retorna aprovação com
   evidências curtas de DOIS blocos distintos; caso contrário,
   auto_review_held deve deixar o registro em Draft.
4. Strapi DEV confirma documento publicado com fonte original,
   atribuição, aprovação e data original corretas.
5. Radar DEV exibe a notícia UMA vez, ordenada por data.
6. Repetir o slot ou reiniciar o worker NÃO duplica publicação.
   Verificar ausência de PUT/POST adicionais e estado CMS/Redis.
7. Verificar retirada/rollback editorial somente com autorização
   operacional, sem tocar em PROD.

A implementação passou em testes unitários e de contrato simulados,
incluindo falha de autoria, revisão HOLD e fluxo aprovado, mas
CI/testes automatizados não são equivalentes à primeira publicação real
nem ao teste de UI Strapi. Manter issues #14 e #18 abertas até esses gates.
