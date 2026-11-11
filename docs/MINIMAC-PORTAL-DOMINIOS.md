# IERC-RN — implantação DEV/MAIN no MiniMac

## Domínios reservados para configuração (não publicados)

| Ambiente | Diretório/branch | Portal | Strapi | Porta do portal | Porta do CMS |
|---|---|---|---|---|---|
| DEV | `/opt/projects/ierc-rn-dev`, `dev` | `https://dev.iercrn.org.br` | `https://strapi-dv.iercrn.org.br/admin` | `127.0.0.1:3101` | `127.0.0.1:1337` |
| MAIN | `/opt/projects/ierc-rn`, `main` | `https://iercrn.org.br` | `https://strapi.iercrn.org.br/admin` | `127.0.0.1:3102` | `127.0.0.1:1338` |

**Não há confirmação de DNS, Cloudflare Tunnel ou Nginx para esses domínios.** Não apontar tráfego nem anunciar lançamento até validar segurança, direitos autorais e acessibilidade. Preservar os containers existentes do PHASSCODE, Grafana, Portainer, nginx-proxy e cloudflared.

Os portais e CMS possuem projetos Docker distintos. Portal DEV usa apenas a rede `ierc-rn-dev-cms-read`, compartilhada exclusivamente com o serviço Strapi DEV; portal MAIN usa a rede **diferente** `ierc-rn-prod-cms-read`. PostgreSQL não participa dessas redes: pertence somente à rede privada de seu próprio CMS. Nos dois portais, a URL interna do CMS é `http://cms:1337`; o DNS do Strapi é **apenas para o navegador dos editores**, não para a comunicação servidor-servidor.

## Ativação local DEV, sem DNS

**1. Verificar portas livres**, sem parar outros projetos:

```bash
sudo ss -lntp | grep -E ':(1337|1338|3101|3102)\\b' || true
```

**2. Atualizar `dev`, gerar segredos do CMS DEV somente se ainda não existir e levantar o Strapi.** Não instalar Node no host.

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace node:22-alpine node cms/scripts/init-env.mjs
docker compose --env-file cms/.env -f compose.cms.yml config --quiet
docker compose --env-file cms/.env -f compose.cms.yml up -d --build
docker compose --env-file cms/.env -f compose.cms.yml ps
curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:1337/_health
```

Resultado esperado para Strapi `/_health`: HTTP **204**; o painel no host é `http://127.0.0.1:1337/admin`, sem domínio remoto ainda. O arquivo `cms/.env` é confidencial; não envie senhas/tokens.

**3. Preparar as variáveis e subir o portal DEV.** A rede `ierc-rn-dev-cms-read` só existe depois que o CMS DEV iniciou.

```bash
cd /opt/projects/ierc-rn-dev
cp -n deploy/portal-dev.env.example deploy/.env.portal.dev
chmod 600 deploy/.env.portal.dev
docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml config --quiet
docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml up -d --build
docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml ps
curl -fsSI http://127.0.0.1:3101/
```

O portal usa o conteúdo-base enquanto `CMS_ENABLED=false`. Só depois de cadastrar no Strapi DEV um API Token de tipo **Read-only**, preencher `CMS_ENABLED=true` e `CMS_READ_TOKEN` no arquivo **local** `deploy/.env.portal.dev` e recriar o container com `docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml up -d --force-recreate`. O token é server-side; não use `NEXT_PUBLIC_` para segredos. Conteúdo continua exigindo **published + editorialStatus=aprovado**.

**Não utilizar `docker compose down -v`**, nem remover volumes PostgreSQL ou Redis existentes.

## Preparação MAIN — não ativar ainda

A `main` atual não contém a Sprint CMS/Curadoria da `dev`. Os arquivos acima foram preparados na `dev`, mas **não foram mesclados nem instalados no MAIN**. Depois de homologação, aprovação da instituição e PR, criar segredos **novos** em `cms/.env.prod` (`node cms/scripts/init-env.mjs --prod` via container Docker), configurar `deploy/.env.portal.prod` com token somente leitura do próprio Strapi PROD, e somente então utilizar `compose.cms.prod.yml` e `compose.portal.prod.yml` na pasta MAIN. Não usar CMS/Redis/volumes DEV em MAIN.

## Amanhã: túnel, Nginx, Cloudflare Access e HTTPS

O MiniMac já possui `nginx-proxy` e `cloudflared`. **Não presumir** que `localhost` de um desses containers seja o host: `127.0.0.1` dentro do container corresponde a ele mesmo. Antes de configurar rotas, levantar a topologia real sem revelar o token do túnel:

```bash
docker inspect nginx-proxy --format '{{json .NetworkSettings.Networks}}'
docker inspect cloudflared --format '{{json .NetworkSettings.Networks}}'
docker exec nginx-proxy nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass|listen' | head -80
docker ps --format 'table {{.Names}}\\t{{.Ports}}'
```

Após esse inventário, escolher Nginx no caminho do túnel já existente ou serviço de origem acessível para `cloudflared`. **Não criar segundo Nginx ouvindo 80/443**, não alterar rotas do PHASSCODE, e não expor PostgreSQL/Redis.

Antes de disponibilizar `strapi.iercrn.org.br` ou `strapi-dv.iercrn.org.br`, configurar Cloudflare Access para **todo o hostname**, com autorização específica de administradores/editores; se possível, proteger `dev.iercrn.org.br` durante a homologação. O Strapi também exige HTTPS real para cookies seguros fora do localhost.

Configurar `PUBLIC_URL=https://strapi-dv.iercrn.org.br` em `cms/.env` e, futuramente, `PUBLIC_URL=https://strapi.iercrn.org.br` em `cms/.env.prod` apenas ao habilitar o proxy. A configuração do Strapi passa a ler `PUBLIC_URL`; após alterar, é necessária **reconstrução do painel** (`docker compose ... up -d --build`). O ajuste `TRUST_PROXY=true` deve ser feito **somente** após validar os headers e a fronteira confiável do proxy; por padrão é `false`.

## Gates de aceitação

- [ ] CMS DEV inicializado e dados persistentes, token read-only e fluxo de aprovação testado
- [ ] Portal DEV saudável em `127.0.0.1:3101`, CMS isolado por rede
- [ ] Backup e **restauração** de PostgreSQL/mídias em ambiente isolado
- [ ] Proxy/túnel auditados; Cloudflare Access ativado antes de expor os painéis
- [ ] Zoom 200/400%, NVDA/VoiceOver/TalkBack e aprovação de conteúdo e imagens
- [ ] PR `dev`→`main` liberado, deploy MAIN com rollback e segredos próprios

A automação RSS `ierc-rn-monitor-dev` segue separada e só gera relatórios; não publica notícias.


## Inventário real da rede (MiniMac, 10/11/2026)

Inspeção enviada pelo operador:

- `cloudflared` está em `network_mode: host` (rede `host`); pode alcançar os endpoints do host em `127.0.0.1:porta`, **desde que respondam no próprio MiniMac**.
- `nginx-proxy` está apenas na bridge Docker `nginx_default`; hospeda as rotas PHASSCODE e não precisa ser alterado para o IERC-RN.
- `sudo ss -lntp` mostrou `127.0.0.1:1337` ocupado pelo Docker; o comando não identifica o nome do container (confirmar com `docker compose --env-file cms/.env -f compose.cms.yml ps`).
- `1338`, `3101` e `3102` não apareceram como portas ocupadas na inspeção.
- CI [#42942516358](https://github.com/SladeSouzaSantos/ierc-rn/actions/runs/42942516358) do commit `d18a26b3`: **success** em `curator-unit`, `build-and-a11y` e `cms-build` (incluindo validação Compose).

### Roteamento recomendado — sem modificar Nginx existente

Como o `cloudflared` usa a rede do **host**, depois de ativar o DNS e as regras de acesso, a aplicação no túnel já existente pode encaminhar diretamente para serviços locais (sem segunda instância do Nginx):

| Hostname público | Service URL planejado no Tunnel | Estado |
|---|---|---|
| `dev.iercrn.org.br` | `http://127.0.0.1:3101` | DEV após smoke |
| `strapi-dv.iercrn.org.br` | `http://127.0.0.1:1337` | **Somente após Cloudflare Access e proteção da rota** |
| `iercrn.org.br` | `http://127.0.0.1:3102` | PROD futura, após homologação |
| `strapi.iercrn.org.br` | `http://127.0.0.1:1338` | PROD futura, **Access obrigatório** |

**Sequência segura:** criar primeiro duas aplicações Cloudflare Access Self-hosted (hostnames Strapi por inteiro, incluindo `/api/*` e `/admin/*`), com política Allow específica; validar a proteção no próprio Tunnel (opção *Protect with Access* / validação do JWT, quando disponível) **antes** de criar a rota pública. Recomenda-se também proteger o portal DEV. Só então cadastrar as rotas publicadas no túnel. Não habilitar uma regra global de negar hostnames sem antes avaliar o impacto nos serviços PHASSCODE existentes.

O Cloudflare Tunnel criptografa o trajeto público até `cloudflared`; a comunicação local pode ser HTTP no loopback se a origem estiver no mesmo host. O conteúdo exibido no domínio institucional MAIN continua condicionado a autorização, validação de acessibilidade e deploy homologado. Os serviços internos de Postgres/Redis **nunca recebem hostname público**.

Ver documentação Cloudflare: [configurar published applications](https://developers.cloudflare.com/tunnel/get-started/), [aplicações Access self-hosted](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) e [roteamento](https://developers.cloudflare.com/tunnel/concepts/routing/).
