# IERC-RN — Nginx MAIN/DEV e Cloudflare Tunnel no MiniMac

**Criado em 13/11/2026.** Os portais estão operacionais no MiniMac:
MAIN em `127.0.0.1:3102`, DEV em `127.0.0.1:3101`. O túnel
`cloudflared` existente foi documentado em `network_mode: host` (inventário
de 10/11). O servidor também hospeda um **outro** `nginx-proxy` com rotas
PHASSCODE que **não deve ser alterado**.

## Topologia segura

```text
Internet HTTPS (Cloudflare edge)
   |
   +-- iercrn.org.br -----------+
   |                            |
   +-- dev.iercrn.org.br -------+-- cloudflared EXISTENTE (network_mode: host)
                                    |
                                    | http://127.0.0.1:18081
                                    v
                             ierc-rn-edge-nginx-1
                             Nginx dedicado:8080
                               |              |
                     Host: MAIN        Host: DEV
                          |                 |
               ierc-rn-main-edge    ierc-rn-dev-edge
                          |                 |
               ierc-rn-main-portal  ierc-rn-dev-portal
                          |                 |
               CMS PROD read-net   CMS DEV read-net
```

**Isolamento:** redes Docker distintas para o tráfego de proxy dos dois
portais. O Nginx novo não participa de nenhuma rede privada do CMS.
Os portais preservam as redes `cms_read` existentes, seus tokens e bancos
distintos. `127.0.0.1:18081` é a **única** porta publicada pelo novo Nginx.
As portas 80/443 permanecem com o `nginx-proxy` original.
O Cloudflare Tunnel encaminha usando o hostname, preservado ou forçado
em `HTTP Host Header`. Não há rota pública para Strapi, Redis ou PostgreSQL.

Os arquivos versionados são:
- `infra/nginx/conf.d/ierc-rn-main.conf` (MAIN, `iercrn.org.br`)
- `infra/nginx/conf.d/ierc-rn-dev.conf` (DEV, `dev.iercrn.org.br`)
- `infra/nginx/conf.d/00-default-deny.conf` (Host não reconhecido fecha conexão)
- `infra/nginx/nginx.conf` (servidor Nginx não privilegiado)
- `compose.nginx.yml` (proxy dedicado, sem segredos)
- `scripts/check-ierc-nginx-tunnel.sh` (verificação apenas de leitura)

> **Importante:** adicionar arquivos `nginx.conf` ao Git **não** altera as
> rotas do Cloudflare Tunnel. Uma rota *Published application* deve ser
> cadastrada no túnel remoto ou integrada ao `config.yml` local. Não
> publique o hostname DEV antes de habilitar Cloudflare Access.

## 1. Checagens de segurança antes de iniciar

Execute no host MiniMac, sem imprimir o comando/token do túnel:

```bash
docker inspect cloudflared --format '{{.HostConfig.NetworkMode}}'
docker inspect nginx-proxy --format '{{.Name}} {{.State.Status}}'
ss -lnt | grep -E ':18081\\b' || true
```

Esperado: `host`, `/nginx-proxy running`, porta 18081 disponível.
Se `cloudflared` **não** estiver em rede host, NÃO cadastre
`127.0.0.1:18081` no Tunnel: dentro da bridge, localhost é o
contêiner cloudflared. Primeiro reavalie a topologia.

## 2. Criar redes dedicadas sem interferir em outras aplicações

```bash
docker network inspect ierc-rn-main-edge >/dev/null 2>&1 || \
  docker network create --driver bridge ierc-rn-main-edge
docker network inspect ierc-rn-dev-edge >/dev/null 2>&1 || \
  docker network create --driver bridge ierc-rn-dev-edge
```

Os dois Compose de portal declaram cada rede externa, criada **antes** de
subir os portais. Não conecte o proxy a `ierc-rn-prod-cms-read` nem
`ierc-rn-dev-cms-read`; isso romperia o isolamento CMS.

## 3. Atualizar DEV e MAIN e adicionar somente a rede de proxy

A atualização de rede pode recriar brevemente cada contêiner **portal**;
não há rebuild necessário e nenhum CMS/Redis é reiniciado.

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml \
  up -d --no-deps portal
docker compose --env-file deploy/.env.portal.dev -f compose.portal.dev.yml ps

cd /opt/projects/ierc-rn
git pull --ff-only origin main
docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml \
  up -d --no-deps portal
docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml ps
```

Se o Compose informar que faltam redes externas, retorne à etapa 2.
Caso o contêiner de portal não tenha a versão atualizada do código,
`up -d --build --no-deps portal` é opcional; **não** é necessário para
esta atualização de rede se as imagens existentes já forem saudáveis.

## 4. Iniciar o Nginx dedicado

```bash
cd /opt/projects/ierc-rn
docker compose -f compose.nginx.yml config --quiet
docker compose -f compose.nginx.yml up -d --wait nginx
docker compose -f compose.nginx.yml ps

# Verifique os dois caminhos HTTP locais pelo mesmo proxy:
curl -sS -o /dev/null -w 'MAIN: %{http_code}\\n' \
  -H 'Host: iercrn.org.br' http://127.0.0.1:18081/
curl -sS -o /dev/null -w 'DEV: %{http_code}\\n' \
  -H 'Host: dev.iercrn.org.br' http://127.0.0.1:18081/
bash scripts/check-ierc-nginx-tunnel.sh
```

Esperado: `200` para os dois portais e
`IERC_NGINX_TUNNEL_LOCAL_OK`. O Nginx funciona em seu próprio
contêiner com usuário não privilegiado, rootfs somente leitura,
capabilities removidas e arquivos de configuração em modo read-only.
Se houver 502/503, verifique alias e redes:

```bash
docker network inspect ierc-rn-main-edge --format '{{range .Containers}}{{println .Name}}{{end}}'
docker network inspect ierc-rn-dev-edge --format '{{range .Containers}}{{println .Name}}{{end}}'
docker compose -f compose.nginx.yml logs --tail=80 nginx
```

Não altere nginx-proxy, Redis nem o CMS para corrigir uma falha de rede
no Nginx do IERC.

## 5. Cadastrar duas rotas no Cloudflare Tunnel EXISTENTE

No painel **Cloudflare > Networking > Tunnels > [seu túnel] > Routes >
Add route > Published application**, adicionar:

| Hostname público | Service URL (origem HTTP) | HTTP Host Header |
|---|---|---|
| `iercrn.org.br` | `http://127.0.0.1:18081` | `iercrn.org.br` |
| `dev.iercrn.org.br` | `http://127.0.0.1:18081` | `dev.iercrn.org.br` |

O campo **HTTP Host Header** fica em *Additional application settings >
HTTP*. A separação do Nginx é baseada nesse cabeçalho. Não tente acessar
HTTPS no porto 18081: o TLS público termina na Cloudflare e a conexão
`cloudflared -> Nginx` é HTTP local em loopback.

**ANTES** de publicar `dev.iercrn.org.br`, crie uma aplicação
Cloudflare Access *Self-hosted* para **todo** esse hostname com política
Allow restrita às pessoas autorizadas. Confirme o desafio/login antes
de divulgar o URL. Para Strapi, caso decida publicar o admin futuramente,
crie **separadamente** Access para cada hostname e reavalie CORS/cookies,
URLs públicas e cabeçalhos de proxy; **este deploy não publica Strapi**.

Se o túnel for gerenciado por `config.yml` local em vez de painel,
mescle estas duas regras **antes** da regra catch-all existente, sem
sobrescrever nenhuma rota dos projetos PHASSCODE:

```yaml
# TRECHO PARA MESCLAR — NÃO É UM config.yml COMPLETO
- hostname: iercrn.org.br
  service: http://127.0.0.1:18081
  originRequest:
    httpHostHeader: iercrn.org.br
- hostname: dev.iercrn.org.br
  service: http://127.0.0.1:18081
  originRequest:
    httpHostHeader: dev.iercrn.org.br
```

Nunca imprima o token Cloudflare, `docker inspect ...Env`, credenciais
`config.yml`, cookies ou tokens do CMS no terminal compartilhado.
O dashboard ou configuração do túnel não são alterados por `git pull`.

## 6. Smoke externo após criar as rotas

```bash
curl -I --max-time 15 https://iercrn.org.br
curl -I --max-time 15 https://dev.iercrn.org.br
```

MAIN deve responder com HTTP 200 ou redirecionamento legítimo.
DEV **com Access configurado** deve redirecionar/solicitar autenticação
para usuário não autenticado. Nem um HTTP 200 do Nginx nem o ícone de
túnel Healthy provam que Access está protegido. Valide manualmente
pelo navegador anônimo e confira os eventos de autenticação.

## 7. Reversão e manutenção

Para suspender exposição, remova/disable as duas rotas de *Published
application* no Cloudflare Dashboard e depois, se necessário,
`docker compose -f compose.nginx.yml stop nginx`.
Esse procedimento não toca os outros túneis ou hosts do PHASSCODE.
Não use `down -v`, `docker network prune` nem remova as redes
`cms_read`. A porta 18081 não deve ser exposta em `0.0.0.0`.

Documentação oficial:
- https://developers.cloudflare.com/tunnel/get-started/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
