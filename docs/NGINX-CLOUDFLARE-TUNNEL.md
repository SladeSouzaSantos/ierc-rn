# IERC-RN — um único Nginx compartilhado e Cloudflare Tunnel

**Atualizado em 13/11/2026.** Reutilizamos o `nginx-proxy` existente do
PHASSCODE, que recebe o Cloudflare Tunnel `minimac-server` pela porta
`localhost:80`. **Não criar um segundo Nginx.** O contêiner
`ierc-rn-edge-nginx-1` criado anteriormente deve ser desligado e removido
(sem apagar redes/volumes de outros projetos).

## Topologia

```text
Cloudflare HTTPS
  -> cloudflared EXISTENTE (network_mode=host)
     -> http://127.0.0.1:80
        -> nginx-proxy EXISTENTE (Docker; rede nginx_default)
           +-- Host iercrn.org.br     -> ierc-rn-main-portal:3000
           +-- Host dev.iercrn.org.br -> ierc-rn-dev-portal:3000
```

Os dois portais ficam na **mesma rede externa do Nginx**, com aliases
exclusivos. Cada um continua ligado à **própria** rede `cms_read`; nenhum
CMS/PostgreSQL/Redis entra na rede compartilhada. A porta 80 continua com
o `nginx-proxy` já existente. Cloudflare não precisa de segundo túnel,
nem de porta 18081.

Arquivos versionados:
- `infra/nginx/shared-main.conf`: somente o vhost `iercrn.org.br`
- `infra/nginx/shared-dev.conf`: somente o vhost `dev.iercrn.org.br`
- `scripts/prepare-shared-nginx.sh main|dev`: prepara um `nginx.conf`
  **local e ignorado pelo Git** em cada checkout (sem sobrescrever existente)
- `scripts/check-ierc-shared-nginx.sh`: apenas leitura, confirma o proxy
  original e os dois hostnames
- `compose.portal.prod.yml` e `compose.portal.dev.yml`: compartilham
  `IERC_PROXY_NETWORK` (padrão `nginx_default`), com aliases distintos

O modelo segue a convenção do PHASSCODE: um vhost por projeto e rede
externa com alias único. `nginx.conf` é gerado em cada checkout porque
a mesma versão do Git existe em MAIN e DEV, mas cada ambiente deve
usar **apenas o seu** `server_name`.

## 0. Desligar apenas o Nginx adicional, ANTES do git pull

Na MAIN, enquanto `compose.nginx.yml` ainda existe no checkout antigo:

```bash
cd /opt/projects/ierc-rn
docker compose -f compose.nginx.yml stop nginx
docker compose -f compose.nginx.yml rm -f nginx
docker ps --format '{{.Names}}' | grep -E '(^nginx-proxy$|ierc-rn-edge-nginx)' || true
```

Esperado: **somente `nginx-proxy`**. Não usar `down -v`, não reiniciar
`nginx-proxy` nem `cloudflared`. As redes antigas
`ierc-rn-main-edge` e `ierc-rn-dev-edge` podem permanecer sem uso;
**não é necessário removê-las**.

## 1. Verificar a rede e o carregamento do Nginx existente

```bash
docker inspect nginx-proxy \
  --format '{{range $name, $net := .NetworkSettings.Networks}}{{println $name}}{{end}}'
docker inspect cloudflared --format '{{.HostConfig.NetworkMode}}'
docker exec nginx-proxy nginx -T 2>/dev/null |
  grep -E 'include .*\/opt\/projects|include .*nginx\.conf|server_name' | tail -35
docker inspect nginx-proxy \
  --format '{{range .Mounts}}{{println .Destination}}{{end}}'
```

Confirme:
1. A rede externa do `nginx-proxy`, documentada como `nginx_default`.
2. `cloudflared` em rede `host`.
3. Se `/opt/docker-stack/proxy/nginx/conf.d/projects.conf` realmente
   inclui `/opt/projects/*/nginx.conf` **dentro do contêiner** e se
   os diretórios `/opt/projects/ierc-rn` e `.../ierc-rn-dev` estão
   montados e visíveis nesse contêiner.

**Não presumir o include apenas porque um repositório PHASSCODE contém
um `nginx.conf` de exemplo.** Se o include ou bind mount não existir,
pare aqui: será preciso editar o Compose/configuração **existente** do
proxy, sem criar outra instância e sem sobrescrever o `projects.conf`.
Não recarregue o Nginx com um include inexistente.

## 2. Preparar vhosts e conectar os portais ao proxy

Depois de confirmar a rede correta (se não for `nginx_default`, atribua
`IERC_PROXY_NETWORK` ao nome confirmado em **todos** os comandos):

```bash
cd /opt/projects/ierc-rn
git pull --ff-only origin main
bash scripts/prepare-shared-nginx.sh main

cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/prepare-shared-nginx.sh dev

# A conexão ao Nginx é via rede Docker, não localhost do contêiner.
docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml up -d --no-deps portal

cd /opt/projects/ierc-rn
docker compose --env-file deploy/.env.portal.prod \
  -f compose.portal.prod.yml up -d --no-deps portal
```

Estes `up` podem recriar brevemente **somente os portais**.
Não afetam as imagens do CMS, bancos, Redis ou worker.

Antes de alterar o proxy, verifique as conexões à rede e os aliases:

```bash
docker network inspect nginx_default \
  --format '{{range .Containers}}{{println .Name}}{{end}}'
docker exec nginx-proxy nginx -t
```

Se `nginx -t` falhar, **não execute reload**. Identifique se a causa
está em algum vhost ou include e corrija preservando o arquivo original.

## 3. Recarregar o Nginx ORIGINAL e testar

**Somente** após o `nginx -t` passar e o include carregar os dois
arquivos:

```bash
docker exec nginx-proxy nginx -s reload

cd /opt/projects/ierc-rn
bash scripts/check-ierc-shared-nginx.sh

curl -sS -o /dev/null -w 'PHASSCODE: %{http_code}\\n' \
  -H 'Host: gbc.phasscode.com' http://127.0.0.1:80/
```

Esperado: `IERC_SHARED_PROXY_OK`, `HTTP 200` para as duas páginas
IERC-RN e nenhuma regressão nas rotas PHASSCODE. Um status `301/302`
pode ser legítimo dependendo do aplicativo. Se não encontrar um vhost,
verifique se o proxy carrega os `nginx.conf` das duas pastas.

## 4. Cloudflare: manter PORTAIS na porta 80, não 18081

O operador já criou os Published Applications no túnel
`minimac-server`. Manter:

| Rota pública | Origin service |
| --- | --- |
| `gbc.phasscode.com`, `devgbc.phasscode.com` | `http://localhost:80` (inalterado) |
| `api.phasscode.com`, `devapi.phasscode.com` | `http://localhost:80` (inalterado) |
| `iercrn.org.br` | `http://localhost:80` |
| `dev.iercrn.org.br` | `http://localhost:80` |

Preserve o header HTTP `Host` original. Se houver **HTTP Host Header**
customizado nas rotas, ele deve corresponder exatamente ao hostname
da linha. Regras e DNS no painel permanecem intactos na migração
para o Nginx único.

**Cloudflare Access:** bloquear `dev.iercrn.org.br` para acesso
externo não autorizado antes de divulgar o domínio.

### Painéis Strapi: rotas DISTINTAS, não vhosts da rede proxy

O túnel já contém `strapi.iercrn.org.br` e
`strapi-dev.iercrn.org.br` (nome confirmado pela captura da conta).
Eles ainda apontavam para `http://localhost:80`, mas este guia **não**
cria vhosts públicos para o Strapi no Nginx compartilhado.

**ANTES de alterar os destinos ou expor o painel**, configurar
Cloudflare Access **Self-hosted** de hostname inteiro com Allow restrito
aos editores para **cada um**, e verificar acesso negado anônimo. Só
então alterar as origens do túnel para:
- `strapi.iercrn.org.br` -> `http://localhost:1338` (CMS PROD)
- `strapi-dev.iercrn.org.br` -> `http://localhost:1337` (CMS DEV)

Os CMS permanecem publicados no MiniMac **apenas em 127.0.0.1**; o
`cloudflared` em network host é o único intermediário externo. Confirme
`PUBLIC_URL`, cookies, cabeçalhos `X-Forwarded-Proto` e
`TRUST_PROXY` segundo o guia CMS antes de usar os painéis na web.
Não liberar rota de Strapi sem Access.

## 5. Reversão sem afetar outros projetos

Para reverter o Nginx compartilhado, faça uma cópia local dos vhosts
IERC-RN, **somente** remova `nginx.conf` de cada checkout após
confirmar que são os arquivos gerados pelo script (compare com os
templates), rode `docker exec nginx-proxy nginx -t` e depois
`docker exec nginx-proxy nginx -s reload`. Os vhosts PHASSCODE
permanecem intocados.

É possível deixar a rede compartilhada conectada aos portais sem
prejuízo; não execute `docker network prune`, `docker system prune`,
`down -v` ou `docker volume prune`.

**Importante:** `git pull` não altera o Nginx global nem o dashboard
Cloudflare. Tudo que envolve o proxy em execução precisa de testes
no próprio MiniMac.
