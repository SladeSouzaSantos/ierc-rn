# IERC-RN — Curadoria automática MAIN/PROD, LLMs gratuitas (12/11/2026)

Este guia ativa **publicação automática real** no Strapi PROD, sob opt-in,
após backup/restore, validação de tokens, revisão por IA fundamentada em
artigo integral e prova de execução supervisionada. A DEV **não é desligada**.

## Situação e restrições

- O operador confirmou portal PROD e Strapi PROD saudáveis (localhost
  `3102` HTTP 200 e `1338` HTTP 204) e portal→CMS PROD HTTP 200 autenticado.
- A publicação automática já era permitida no ambiente DEV. A arquitetura
  atual passa a permitir PROD **somente com autorização distinta explícita**.
- **Ambiente MAIN**: `/opt/projects/ierc-rn`, branch `main`.
- **Compose PROD**: `compose.curator.prod.yml`, projeto `ierc-rn-curator-prod`.
  Redis `curator_redis_prod` e rede `ierc-rn-curator-prod_worker_prod_private`
  distintos da DEV. O worker só alcança a rede privada
  `ierc-rn-cms-prod_cms_prod_private`; não há portas públicas.
- **Segredos exclusivos** em `curator/.env.prod` com permissão 0600. O script
  e o deploy não copiam nem substituem esse arquivo e não o enviam ao GitHub.
- Operação `schedule` nas janelas **08h, 13h e 19h, America/Fortaleza**;
  no máximo **uma candidata por horário**. Sem execução retroativa.
- Somente artigos originais da **Agência Brasil/EBC**, de fontes explicitamente
  permitidas. Escrita em PROD não inclui comunicados próprios do IERC nem
  imagens de terceiros. A Comissão Europeia permanece fora do allowlist inicial
  por falhas de conectividade; fontes em preview não publicam.
- Para cada candidata elegível: verificação de licença/autoria, evidência de
  artigo integral, geração original com IA, revisão independente por IA com
  evidências, validações técnicas, criação de Draft, e publicação somente se
  todas as verificações aprovarem. Rejeição/incerteza preserva Draft ou descarta
  sem publicação. A IA pode errar: exige auditoria editorial humana amostral
  e possibilidade de retirar material do ar.

## 1. Guardas de custo: somente free

A ordem de tentativa no roteador é **Groq → Gemini → OpenRouter → Ollama local
(opcional)**, com cotas em Redis e fallback em falhas. As configurações atuais
no arquivo `curator/.env.prod` devem permanecer nas opções sem custo:

- `CURATOR_GROQ_FREE_TIER_CONFIRMED=true`, somente após confirmar plano
  gratuito e modelo disponível no **painel da conta**;
- `CURATOR_GEMINI_FREE_TIER_CONFIRMED=true`, confirmar plano sem cobrança no
  Google AI Studio; não utilizar projeto faturado sem controle;
- OpenRouter somente `openrouter/free` ou modelo terminado em `:free`.
  Nenhum fallback para modelo pago é admitido pelo roteador;
- `CURATOR_GLOBAL_MAX_CALLS=30`, cotas por provedor `=10`, limites de
  tentativas/timeouts e cooldown existentes; reservar cota para *duas* chamadas
  por matéria (geração e segunda revisão). Os limites globais são por
  instância Redis; não devem ser confundidos com o limite compartilhado
  da conta do provedor, que pode incluir a DEV.

**Importante:** a flag `...FREE_TIER_CONFIRMED=true` é confirmação
do operador, **não** verificação técnica de faturamento externo. A API de
Gemini/Groq pode ter plano pago habilitado na mesma conta. Sem garantia
independente de bloqueio de gastos na plataforma, usar conta/chave de
plano free, sem billing ativo, e acompanhar o painel de consumo.

## 2. Criar tokens Custom separados no Strapi PROD

Acessar o painel Strapi PROD via túnel SSH no Windows:

`http://127.0.0.1:11338/admin` (se encaminhar 11338→1338).

Em Settings → API Tokens:

| Token | Tipo | Permissões News-article |
| --- | --- | --- |
| `IERC Curator PROD Drafts` | Custom | `find` e `create` |
| `IERC Curator PROD Publisher` | Custom | `findOne` e `update` |
| `IERC Curator PROD Reader` | Custom / Read-only | somente `find` |

Preservar o `IERC-RN Next.js PROD` como token de leitura exclusivo do portal
`deploy/.env.portal.prod`. Não utilizar Full Access, token de admin nem
tokens do Strapi DEV. Se um token foi exibido em público, revogar e gerar outro.

## 3. Completar o arquivo já existente sem sobrescrever chaves

```bash
cd /opt/projects/ierc-rn
chmod 600 curator/.env.prod
nano curator/.env.prod
```

Configurar **somente uma ocorrência de cada chave**; os valores abaixo
são configuração, não os segredos (preservar as chaves LLM e Strapi já inseridas):

```dotenv
CURATOR_INSTANCE_KIND=prod
CURATOR_ENABLED=true
CURATOR_WRITE_DRAFTS=true
CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true
CURATOR_AUTO_PUBLISH_ENABLED=true
CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED
CURATOR_PROD_WRITE_ACK=PROD_WRITES_APPROVED
CURATOR_PROD_AUTO_PUBLISH_ACK=PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED
CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES=agencia-brasil-direitos,agencia-brasil-educacao,agencia-brasil-esportes,agencia-brasil-internacional
CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED=false
CURATOR_SCHEDULE_LIMIT=1
CURATOR_ONCE_LIMIT=1
CURATOR_GLOBAL_MAX_CALLS=30
CURATOR_REDIS_URL=redis://redis:6379
CURATOR_CMS_URL=http://cms:1337
CURATOR_STRAPI_DRAFT_TOKEN=TOKEN_CUSTOM_DRAFT_PROD
CURATOR_STRAPI_PUBLISH_TOKEN=TOKEN_CUSTOM_PUBLISH_PROD
CURATOR_STRAPI_READ_TOKEN=TOKEN_READ_ONLY_PROD
CURATOR_GROQ_FREE_TIER_CONFIRMED=true
CURATOR_GEMINI_FREE_TIER_CONFIRMED=true
CURATOR_OPENROUTER_MODEL=openrouter/free
```

`CURATOR_PROD_EBC_ARCHIVE_ACK` só é exigido se o operador habilitar
a descoberta no arquivo de listagens históricas, que **deve permanecer
desligada** no início (`CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED=false`).

As confirmações de publicação PROD não habilitam automaticamente o
worker. Elas apenas permitem ao pré-check autorizar sua execução.

## 4. Backup PROD com restauração isolada — obrigatório

O script abaixo faz dump do PostgreSQL PROD, arquiva uploads e os segredos
em diretório privado, verifica integridade e restaura o dump em um Postgres
temporário **sem rede**. Ele não limpa nem reinicia volumes:

```bash
cd /opt/projects/ierc-rn
git status --short
bash -n scripts/backup-cms-prod.sh
bash scripts/backup-cms-prod.sh
```

É obrigatório terminar com
`Restore rehearsal passed: ... public tables` e gerar um
`cms-backups/prod-*/RESTORE_VERIFIED.txt` dos últimos 7 dias.
**Não cole logs com chaves, não compartilhe a pasta de backup.**
Criar cópia criptografada também **fora do MiniMac**.
Esse teste restaura o banco; os uploads são arquivados e validados,
mas o teste de recuperação de mídia na aplicação continua um gate humano.

## 5. Construir e executar pré-check PROD sem consumo de IA

```bash
cd /opt/projects/ierc-rn

docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator build worker

bash -n scripts/preflight-curator-autopublish-prod.sh
bash scripts/preflight-curator-autopublish-prod.sh
```

Esperado: `PROD_PREFLIGHT_OK`. Valida segredos isolados, identidade PROD,
backup/restauração recente, modelo/conta free-confirmed, limite único,
fontes autorizadas, tokens distintos e rede PROD. **Não consulta provedores
de IA, não escreve rascunhos, não publica notícias.** Também não comprova,
isoladamente, os privilégios efetivos no Strapi.

## 6. Execução supervisionada de uma candidata (pode PUBLICAR)

Primeiro iniciar **somente o Redis PROD** e confirmar saúde:

```bash
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator up -d --wait redis
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator exec -T redis redis-cli ping
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator ps
```

Esperado: `PONG` e `healthy`. **Se o Redis PROD havia falhado
com `setpriv: setresuid failed: Operation not permitted` e
`Restarting (127)`**, atualize a MAIN para o commit que contém a
correção de capacidades do Redis e recrie **somente** seu contêiner:

```bash
git pull --ff-only origin main
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator up -d --no-deps --force-recreate --wait redis
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator exec -T redis redis-cli ping
```

O Redis oficial precisa das capacidades `CHOWN`, `SETGID` e
`SETUID` apenas durante o início para ajustar o volume e trocar de
usuário. O worker de IA continua com `cap_drop: [ALL]`, sem
`cap_add`. Não remova volumes, não desative o isolamento e não
reinicie a DEV.

Agora executar **uma** tentativa real no PROD, sabendo que ela pode publicar
automaticamente uma notícia que passe nas verificações:

```bash
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator run --rm --no-deps -T worker node src/cli.mjs once
```

Interpretar retorno:
- `draft_published` / evento `auto_published`: publicou uma matéria.
- `draft_created_review_pending`: Draft criado, revisão inconclusiva.
- `article_evidence_unavailable`: direitos/texto integral insuficientes;
  não publicou.
- `draft_created_publish_failed`: falha ao publicar. Verificar CMS
  antes de repetir; não criar duplicatas.
- `count:0`: nenhuma candidata; não equivale a prova de publicação.

Conferir título, data original, autoria e URL, atribuição da fonte,
licença, corpo, `editorialStatus=aprovado`, `publishedAt`, visibilidade
no Radar MAIN (`http://127.0.0.1:3102/radar-da-inclusao`) e link individual.
Uma revisão por IA não substitui a auditoria humana por amostragem.

## 7. Ativar publicação automática nos horários fixos

**Após inspeção da primeira execução e dos controles acima**, ativar
o scheduler PROD separadamente da DEV:

```bash
cd /opt/projects/ierc-rn
bash scripts/preflight-curator-autopublish-prod.sh
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator up -d --no-deps worker
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator ps
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator logs --tail=100 worker
```

Esperado `schedule_started` com `writeDrafts:true`, `autoPublish:true`,
`hours:["08","13","19"]`. Não significa que foi publicada notícia:
acompanhar `auto_published` e confirmar no site e no Strapi.
O worker reserva uma janela de execução por horário em Redis.
Ambos os agendadores DEV e PROD podem consumir a **mesma cota externa**
se suas chaves LLM forem iguais; o Redis local não sincroniza cotas entre
instâncias. Ajustar limites por conta para impedir cobrança e rate-limit.

**Não** executar `down -v`, `docker volume prune`, nem copiar
`curator/.env` DEV para PROD. Os três arquivos `.env.prod` do Strapi,
portal e curadoria têm finalidades diferentes; nenhum deve ir ao GitHub.

## 8. Suspensão e correção

Interromper somente o agendador da PROD (sem apagar Redis ou Drafts):

```bash
cd /opt/projects/ierc-rn
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator stop worker
```

Para impedir reinício com publicação, editar `curator/.env.prod` e definir
`CURATOR_ENABLED=false`, `CURATOR_WRITE_DRAFTS=false`,
`CURATOR_AUTO_PUBLISH_ENABLED=false`. Conteúdo já publicado deve
ser despublicado diretamente no Strapi PROD. Em caso de token
comprometido, revogar o token específico e gerar outro.

As issues #14 (evidência de publicação automática) e #16 (infraestrutura,
DNS/Access/acessibilidade) permanecem abertas até teste real e
homologação editorial.
