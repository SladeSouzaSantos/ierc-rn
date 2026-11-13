# IERC-RN — Preparação MAIN no MiniMac (12/11/2026)

**Objetivo:** preparar e iniciar **localmente**, quando decidido pelo operador,
uma instância PROD independente do ambiente DEV, sem publicar o domínio, sem
copiar dados de DEV e **sem ativar o agendador de IA automaticamente**.

O código `dev`/`main` foi sincronizado pelo PR #20. Isso não significa que
`strapi.iercrn.org.br` ou `iercrn.org.br` já estão implantados, protegidos
ou homologados. Este documento não é uma autorização para abrir o domínio.

## Isolamento obrigatório

| Recurso | DEV (preservada) | MAIN/PROD (nova) |
| --- | --- | --- |
| Pasta | `/opt/projects/ierc-rn-dev` | `/opt/projects/ierc-rn` |
| Branch | `dev` | `main` |
| CMS compose | `compose.cms.yml` | `compose.cms.prod.yml` |
| Projeto CMS | `ierc-rn-cms` | `ierc-rn-cms-prod` |
| Banco | `ierc_cms` | `ierc_cms_prod` |
| Banco/volumes | DEV próprios | PROD próprios |
| Segredos Strapi | `cms/.env` | `cms/.env.prod` |
| Admin local | 127.0.0.1:1337 | 127.0.0.1:1338 |
| Portal compose | `compose.portal.dev.yml` | `compose.portal.prod.yml` |
| Projeto portal | `ierc-rn-portal-dev` | `ierc-rn-portal-prod` |
| Portal local | 127.0.0.1:3101 | 127.0.0.1:3102 |
| Rede portal↔CMS | `ierc-rn-dev-cms-read` | `ierc-rn-prod-cms-read` |
| Publicação IA | worker DEV opt-in separado | **não suportada / não iniciar** |

O comando `--start-local` não lê nem altera banco/volumes/tokens do DEV.
**Nunca** executar `down -v`, `volume prune`, `system prune --volumes`
ou copiar um arquivo `.env` da DEV para a PROD.

## Etapa 1 — Inventário antes de criar serviços

No SSH do MiniMac (Linux), sem imprimir variáveis de ambiente ou tokens:

```bash
cd /opt/projects/ierc-rn
git switch main
git pull --ff-only origin main
git status --short
git rev-parse --short HEAD
docker version --format '{{.Server.Version}}'
docker compose version
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -Ei 'ierc|NAME' || true
ss -lnt | grep -E ':(1337|1338|3101|3102)\b' || true
```

Verifique se **1338 e 3102** não pertencem a serviços de terceiros. Se já
pertencerem a serviços da MAIN, audite os contêineres e volumes antes de
reconstruir. O script não executa comandos destrutivos.

## Etapa 2 — Segredos exclusivos (sem iniciar contêineres)

```bash
cd /opt/projects/ierc-rn
bash scripts/prepare-main-minimac.sh --prepare
bash scripts/prepare-main-minimac.sh --check
```

Esses comandos:

- exigem branch `main` e checkout rastreado limpo;
- geram `cms/.env.prod` **somente se ausente**, com segredos aleatórios
  usando o Node 22 em um contêiner descartável; nunca sobrescrevem;
- criam `deploy/.env.portal.prod` com `CMS_ENABLED=false` por padrão;
- verificam nomes de banco, segredos mínimos, Compose PROD e, se disponível,
  se os segredos Strapi são diferentes dos da DEV;
- **não iniciam** Strapi, PostgreSQL, portal, Redis ou curadoria;
- não enviam segredos a GitHub, chat ou logs de configuração.

Ambos os arquivos são ignorados pelo Git. Preserve cópia cifrada de segredos
em armazenamento restrito e separado do MiniMac.

## Etapa 3 — Iniciar apenas no loopback (homologação local)

Depois da verificação de portas, da avaliação de recursos do MiniMac e
da confirmação de que não há outro ambiente PROD em operação:

```bash
cd /opt/projects/ierc-rn
bash scripts/prepare-main-minimac.sh --start-local

docker compose --env-file cms/.env.prod -f compose.cms.prod.yml ps
docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml ps
curl -s -o /dev/null -w 'CMS PROD: %{http_code}\n' http://127.0.0.1:1338/_health
curl -s -o /dev/null -w 'Portal PROD: %{http_code}\n' http://127.0.0.1:3102/
curl -s -o /dev/null -w 'API anonima: %{http_code}\n' http://127.0.0.1:1338/api/news-articles
```

Esperado: CMS `204`, portal `200`, API editorial anônima `401` ou
`403`. **Falhas não justificam apagar volumes**. Inspecione os logs dos
serviços PROD, sem revelar `.env` nem token.

O CMS PROD nasce **vazio** (nenhum evento, notícia, usuário, aprovação ou
imagem é migrado da DEV). Conteúdo institucional base continua disponível
mesmo com `CMS_ENABLED=false`.

### Criar o administrador exclusivamente na PROD

Antes de criar a conta, confirme que a conexão é com a **porta 1338**, não
1337. Se estiver acessando de outro computador, abra um túnel SSH local,
sem expor a porta administrativa à rede:

```bash
ssh -N -L 1338:127.0.0.1:1338 USUARIO@HOST_DO_MINIMAC
```

Com o túnel ativo, use no navegador **http://127.0.0.1:1338/admin**.
Crie uma identidade administrativa distinta da DEV, com credenciais
exclusivas e controles de acesso. **Não use token DEV**.

No Strapi PROD, crie um token **Read-only** para as coleções necessárias,
sem criação/edição/publicação. Somente após verificar esse token:

1. Edite **localmente** `deploy/.env.portal.prod`: `CMS_ENABLED=true`
   e `CMS_READ_TOKEN=<token exclusivo da PROD>`, sem imprimir segredos.
2. Execute `bash scripts/prepare-main-minimac.sh --check`.
3. Reinicie **somente o portal**:
   ```bash
   docker compose --env-file deploy/.env.portal.prod \
     -f compose.portal.prod.yml up -d --no-deps --force-recreate portal
   ```
4. Comprove que só registros `published` + `editorialStatus=aprovado`
   são exibidos. Sem conteúdo aprovado, a agenda deverá ficar vazia.

## Etapa 4 — Segurança antes de publicar o domínio

- Auditar backups e **restauração testada** do PostgreSQL PROD, uploads
  e segredos; backup criptografado também **fora do host**.
- Confirmar aprovação institucional, direitos de imagem, titularidade
  da chave Pix e ausência de conteúdo fictício/rascunhos visíveis.
- Proteger o hostname `strapi.iercrn.org.br` **inteiro** com Cloudflare
  Access, inclusive `/admin`, `/api` e arquivos, e confirmar acesso
  negado a pessoas não autorizadas.
- Validar DNS/TLS, políticas de proxy, cabeçalhos e confiabilidade da
  conexão antes de configurar `PUBLIC_URL` / `TRUST_PROXY`.
- Conferir a rota do `cloudflared` existente e a origem correta
  `http://127.0.0.1:3102` no MiniMac, sem mexer nos projetos PHASSCODE.
- Somente depois de todos os gates liberar `https://iercrn.org.br`.

**Não inclua o worker `compose.curator.dev.yml` na MAIN**.
A produção tem seu próprio `compose.curator.prod.yml`, Redis e credenciais
separados; para preparar e habilitar a autopublicação com LLMs gratuitas,
siga exclusivamente o [runbook de curadoria PROD](CURADORIA-AUTOMATICA-PROD-MINIMAC.md),
com backup/restauração e pré-check específicos. A inicialização local do
portal/CMS **não inicia o worker**. A DEV mantém seu monitor e sua curadoria
independentes e não deve ser reiniciada por esta operação.

## Comprovação esperada

- `MAIN_PREPARED` e `PREFLIGHT_MAIN_LOCAL_OK` sem segredos expostos;
- se inicializado, `MAIN_LOCAL_STARTED`, saúde CMS/portal e API anônima bloqueada;
- `docker compose ps` mostra os projetos PROD distintos;
- Portal PROD não consulta DEV; data/media CMS PROD nasce em branco;
- domínio público continua fechado até homologação de segurança e conteúdo.

Issues: [#16](https://github.com/SladeSouzaSantos/ierc-rn/issues/16)
(infraestrutura/lançamento), [#14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14)
(provas de curadoria automática em ambos os ambientes, ainda pendentes).
