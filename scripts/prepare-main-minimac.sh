#!/usr/bin/env bash
# IERC-RN MAIN: local-only preparation and opt-in start of the isolated PROD stack.
# Never edits, stops, migrates or copies data from DEV.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat <<'USAGE'
Uso:
  bash scripts/prepare-main-minimac.sh --prepare      # segredos PROD + configuração privada; não inicia serviços
  bash scripts/prepare-main-minimac.sh --check        # verificações sem mudanças
  bash scripts/prepare-main-minimac.sh --start-local  # inicia somente CMS/portal PROD no loopback
  bash scripts/prepare-main-minimac.sh --help
Não cria rotas Cloudflare, não publica notícias automaticamente e não migra dados DEV.
USAGE
}

case "${1:-}" in
  --help) usage; exit 0 ;;
  --prepare|--check|--start-local) mode="$1" ;;
  *) usage >&2; exit 2 ;;
esac
if [[ "$#" -ne 1 ]]; then usage >&2; exit 2; fi

abort() { printf 'BLOQUEADO: %s\n' "$*" >&2; exit 2; }

for tool in git docker grep sed stat; do
  command -v "$tool" >/dev/null 2>&1 || abort "programa ausente: $tool"
done
[[ "$(pwd -P)" == /opt/projects/ierc-rn ]] ||
  abort "use a pasta isolada /opt/projects/ierc-rn no MiniMac, nunca a DEV"
[[ "$(git branch --show-current)" == main ]] || abort "execute no checkout da branch main"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] ||
  abort "existem mudanças rastreadas locais; faça revisão antes de iniciar"
[[ -f compose.cms.prod.yml && -f compose.portal.prod.yml ]] ||
  abort "arquivos Compose PROD não encontrados"
[[ -f cms/scripts/init-env.mjs ]] || abort "gerador de segredos ausente"
[[ -f deploy/portal-prod.env.example ]] || abort "modelo de configuração ausente"
docker compose version >/dev/null 2>&1 || abort "Docker Compose v2 indisponível"

if [[ "$mode" == --prepare ]]; then
  if [[ ! -e cms/.env.prod ]]; then
    echo 'Criando segredos exclusivos do CMS PROD com Node em container (sem Node no host)...'
    docker run --rm --user "$(id -u):$(id -g)" \
      -v "$PWD:/workspace" -w /workspace node:22-alpine \
      node cms/scripts/init-env.mjs --prod
  else
    echo 'cms/.env.prod já existe; preservado sem alterações.'
  fi
  if [[ ! -e deploy/.env.portal.prod ]]; then
    cp deploy/portal-prod.env.example deploy/.env.portal.prod
    chmod 600 deploy/.env.portal.prod
    echo 'Portal PROD preparado com CMS_ENABLED=false.'
  else
    echo 'deploy/.env.portal.prod já existe; preservado sem alterações.'
  fi
fi

[[ ! -L cms/.env.prod && ! -L deploy/.env.portal.prod ]] ||
  abort "arquivos de configuração PROD não podem ser links simbólicos"
[[ -s cms/.env.prod ]] || abort "cms/.env.prod ausente ou vazio; execute --prepare"
[[ -s deploy/.env.portal.prod ]] ||
  abort "deploy/.env.portal.prod ausente ou vazio; execute --prepare"
for file in cms/.env.prod deploy/.env.portal.prod; do
  permission=$(stat -c '%a' "$file")
  [[ "$permission" == 600 || "$permission" == 400 ]] ||
    abort "permissões muito abertas em $file; use chmod 600"
done
for value in 'DATABASE_NAME=ierc_cms_prod' 'DATABASE_USERNAME=ierc_cms_prod' \
             'DATABASE_HOST=db' 'DATABASE_PORT=5432'; do
  grep -qxF "$value" cms/.env.prod ||
    abort "Configuração PROD inválida: campo obrigatório incompatível (${value%%=*})"
done
for name in APP_KEYS DATABASE_PASSWORD ADMIN_JWT_SECRET API_TOKEN_SALT ENCRYPTION_KEY JWT_SECRET; do
  grep -Eq "^${name}=.{32,}$" cms/.env.prod ||
    abort "Segredo PROD ausente ou curto: $name"
done

# Optional consistency check when the operator has an existing DEV checkout.
# Compare in memory only; never print credentials or copy files between environments.
dev_file=/opt/projects/ierc-rn-dev/cms/.env
if [[ -s "$dev_file" ]]; then
  for name in DATABASE_PASSWORD APP_KEYS ADMIN_JWT_SECRET API_TOKEN_SALT ENCRYPTION_KEY JWT_SECRET; do
    prod_value=$(sed -n "s/^${name}=//p" cms/.env.prod)
    dev_value=$(sed -n "s/^${name}=//p" "$dev_file")
    [[ -z "$dev_value" || "$prod_value" != "$dev_value" ]] ||
      abort "segredo compartilhado DEV/PROD detectado: $name"
  done
fi

if grep -qx 'CMS_ENABLED=true' deploy/.env.portal.prod; then
  grep -Eq '^CMS_READ_TOKEN=.{16,}$' deploy/.env.portal.prod ||
    abort "CMS_ENABLED=true exige token de leitura específico da PROD"
elif ! grep -qx 'CMS_ENABLED=false' deploy/.env.portal.prod; then
  abort "defina CMS_ENABLED=false ou CMS_ENABLED=true com token PROD"
fi

# Only validate Compose configuration; never print its resolved secrets.
docker compose --env-file cms/.env.prod -f compose.cms.prod.yml config --quiet ||
  abort "Compose CMS PROD inválido"
docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml config --quiet ||
  abort "Compose Portal PROD inválido"
echo 'PREFLIGHT_MAIN_LOCAL_OK: main, segredos PROD, Compose e tokens verificados.'
echo 'Isolamento: CMS ierc-rn-cms-prod (1338), portal ierc-rn-portal-prod (3102).'
echo 'Nenhum worker de IA ou publicação automática PROD será iniciado.'

if [[ "$mode" == --start-local ]]; then
  echo 'Iniciando exclusivamente os serviços PROD locais, sem expor DNS ou portas públicas...'
  docker compose --env-file cms/.env.prod -f compose.cms.prod.yml \
    up -d --build --wait --wait-timeout 360
  docker compose --env-file deploy/.env.portal.prod -f compose.portal.prod.yml \
    up -d --build --wait --wait-timeout 240
  echo 'MAIN_LOCAL_STARTED: verifique CMS 127.0.0.1:1338/_health e portal 127.0.0.1:3102.'
  echo 'Não criar Cloudflare Tunnel / Access ou disponibilizar o domínio sem homologação.'
elif [[ "$mode" == --prepare ]]; then
  echo 'MAIN_PREPARED: credenciais e Compose prontos. Nenhum container foi iniciado.'
else
  echo 'MAIN_CHECKED: apenas verificação; nenhum arquivo nem container foi alterado.'
fi
