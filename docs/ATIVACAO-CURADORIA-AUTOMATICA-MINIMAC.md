# Ativação controlada — Curadoria IA + publicação automática, MiniMac DEV

> **Este runbook prepara a operação; nenhum commit liga os containers remotos.**
> A autorização do operador de 11/11/2026 cobre ativar a rotina editorial no DEV.
> Não promover a produção nem publicar matérias sem direitos verificados.

## Segurança e escopo

- DEV em `/opt/projects/ierc-rn-dev`, branch `dev`. Worker Compose `ierc-rn-curator-dev`; rede privada CMS `ierc-rn-cms_cms_private`, Redis dedicado; sem portas públicas.
- Janela: **08h, 13h, 19h**, timezone `America/Fortaleza`. **Uma candidata por horário** (`CURATOR_SCHEDULE_LIMIT=1`), Redis com deduplicação e controle de cotas. Não roda no boot fora desses horários.
- Modelos gratuitos na ordem **Groq `openai/gpt-oss-120b` → Gemini `gemini-2.5-flash` → OpenRouter `nvidia/nemotron-3.5-super-vl:free`** (com fallback).
- **Autopublicação DEV:** restrita inicialmente aos quatro RSS próprios da Agência Brasil (`agencia-brasil-direitos`, `agencia-brasil-educacao`, `agencia-brasil-esportes`, `agencia-brasil-internacional`), com validação de autoria, licença, leitura integral, síntese original, segunda revisão IA fundamentada e checagem programática de evidências. Parceiros externos e avisos de reprodução proibida são rejeitados.
- A fonte Comissão Europeia possui política de reutilização no código, mas seu feed está pausado por problemas de conectividade; não incluí-la no primeiro `allowlist`.
- Perkins, WAI, RNIB e IBSA não entram no modo `autoPublish`. O **monitor read-only**, em Compose próprio, continua descobrindo RSS/listagens sem alterar o CMS.
- A IA **pode se equivocar mesmo quando fornece duas citações verificáveis**. A equipe editorial deve verificar amostras, atribuições e corrigir/despublicar problemas imediatamente. Esta rotina não produz comunicados institucionais próprios do IERC-RN.

## A. Antes de ativar

1. No Strapi DEV, em **Settings → API Tokens**, criar token **Custom** apenas para `News-article`: permissões `findOne` e `update`. O token de criação de rascunho deve continuar separado (`find` e `create` somente). **Nunca usar Full Access, o token do portal nem token de PROD.**
2. Confirmar que a política de reutilização da Agência Brasil se aplica ao conteúdo original EBC publicado; o parser já faz triagem individual de autoria e avisos, mas esta proteção não substitui revisão humana amostral.
3. Fazer um backup novo e ensaiar restauração. O script não apaga dados nem faz `down -v`.
4. Confirmar que Gemini/Groq estão em planos sem cobrança e que as chaves do OpenRouter apontam somente para modelos `:free`. Verificar os limites de chamada e o orçamento global.
5. Registrar um ponto de rollback: commit, backup, versão da imagem Docker, e anotar o primeiro documento gerado/publicado.

## B. Configuração **apenas local e em DEV**

```bash
cd /opt/projects/ierc-rn-dev
git switch dev
git pull --ff-only origin dev
bash scripts/backup-cms-dev.sh
chmod 600 curator/.env
nano curator/.env
```

Manter os segredos existentes, configurar **sem duplicar chaves de configuração**:

```dotenv
CURATOR_INSTANCE_KIND=dev
CURATOR_ENABLED=true
CURATOR_WRITE_DRAFTS=true
CURATOR_AUTO_PUBLISH_ENABLED=true
CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true
CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED
CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES=agencia-brasil-direitos,agencia-brasil-educacao,agencia-brasil-esportes,agencia-brasil-internacional
CURATOR_SCHEDULE_LIMIT=1
CURATOR_STRAPI_DRAFT_TOKEN=<TOKEN_CUSTOM_DRAFT_EXISTENTE>
CURATOR_STRAPI_PUBLISH_TOKEN=<TOKEN_CUSTOM_PUBLISH_NOVO>
```

Os campos `<TOKEN...>` são **placeholders**: colar valores reais somente no arquivo privado, nunca no chat nem em comandos de shell. O token do publicador deve ter escopo exclusivamente `findOne + update`.

Conferir o pré-check; ele **não executa a IA, não publica e não imprime credenciais**:

```bash
bash scripts/preflight-curator-autopublish-dev.sh
```

Critério: `PREFLIGHT_OK`. O script exige backup verificado nos últimos sete dias, branch DEV, modo de publicação autenticado e tokens diferentes. Um preflight OK prova apenas os requisitos locais, **não testa autorização de acesso no Strapi nem publicação real**.

## C. Homologação real controlada, sem agendar ainda

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T -e CURATOR_ONCE_LIMIT=1 worker node src/cli.mjs once
```

O comando `once` **pode criar e publicar UMA notícia real no DEV**. A rede do CMS, os dois tokens e o Redis precisam estar ativos. Se nenhum feed tiver candidata pertinente, `count:0` é esperado; aguardar nova notícia e **não relaxar o filtro**. Com candidata original EBC, resultados:

- `draft_published`: CMS confirmou publicação após a segunda revisão e a leitura integral.
- `draft_created_review_pending`: revisão inconclusiva, **rascunho não publicado**.
- `article_evidence_unavailable`: licença, URL, extração, autoria ou disponibilidade insuficiente; **sem publicação**.
- `draft_created_publish_failed`: erro na etapa de publicação; conferir o CMS antes de repetir.
- `already_in_cms`/`seen`: notícia já processada.

Se houver publicação: conferir título, imagem ausente (não copiar de terceiros), corpo, justificativa, `sourceName`, `sourceUrl`, `originType=externa`, `editorialStatus=aprovado`, `approvalReference`, `publishedAt`, autoria EBC e licença. Confirmar aparição em `/radar-da-inclusao` e link do detalhe. **Revisão por IA não equivale à checagem humana**: inspeção por editor é obrigatória na homologação.

## D. Ligar o agendador persistente — somente após gate C

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator up -d --build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator ps
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator logs --tail=80 worker
```

Log de entrada esperado: `schedule_started` com `writeDrafts:true`, `autoPublish:true` e horários `08,13,19`. Ele só roda na janela dos **primeiros três minutos de cada horário**, e após reboot do Docker se o daemon reiniciar. **Não há execução retroativa de horários perdidos**.

Acompanhar ao menos um horário real, registrar `draft_published` ou motivo de retenção, confirmar que não houve publicação duplicada e inspecionar o site. O monitor independente continua com sua própria Redis e Compose: não substitui este agendador.

## E. Parada imediata / rollback seguro

```bash
cd /opt/projects/ierc-rn-dev
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator stop worker
```

Em seguida, no `curator/.env` privado, redefinir `CURATOR_ENABLED=false`, `CURATOR_WRITE_DRAFTS=false`, `CURATOR_AUTO_PUBLISH_ENABLED=false`. **Não executar `docker compose down -v`**, `docker volume prune` ou sobrescrever banco DEV.

Se alguma notícia incorreta já tiver sido publicada, **Unpublish manual no Strapi**, verificando depois `404` no detalhe e ausência no Radar. Parar o worker **não despublica** conteúdo existente. Revogar token de publicação em caso de comprometimento.

## F. Promoção DEV → MAIN e PROD isolada

**Não mesclar** antes de: CI verde, `once` real e documentação da revisão/retirada, observação de horário agendado, backup/restore, direitos editoriais e aprovação institucional; completar testes manuais de acessibilidade, DNS/HTTPS e proteção Cloudflare Access para o Strapi. PR de referência: [#12](https://github.com/SladeSouzaSantos/ierc-rn/pull/12).

A pasta futura é `/opt/projects/ierc-rn` com branch `main`. Os arquivos já existentes da `dev` para deploy futuro são `compose.cms.prod.yml`, `compose.portal.prod.yml`, `deploy/portal-prod.env.example`. Usar projetos Docker separados e segredos novos:

```bash
# Executar na pasta MAIN somente depois do merge/CI e da aprovação de deploy.
cd /opt/projects/ierc-rn
git switch main
git pull --ff-only origin main
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node cms/scripts/init-env.mjs --prod
cp -n deploy/portal-prod.env.example deploy/.env.portal.prod
chmod 600 cms/.env.prod deploy/.env.portal.prod
docker compose --env-file cms/.env.prod -f compose.cms.prod.yml config --quiet
docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml config --quiet
```

Os comandos acima **preparam segredos e validam sintaxe**; não fazem deploy. O PROD terá CMS na porta local 1338 e portal em 3102, bancos e volumes diferentes, tokens exclusivos e Cloudflare Access obrigatório. O código atual **bloqueia `CURATOR_INSTANCE_KIND=prod` para criação/publicação automática**. Não copiar `curator/.env` DEV para MAIN e não abrir publicamente o Strapi. Caso se deseje autopublicação em produção, isso é um gate de segurança próprio a implementar/homologar, não uma consequência automática do merge.
