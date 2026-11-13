#!/usr/bin/env bash
# PROD-only Strapi logical backup + disposable PostgreSQL restore rehearsal.
# Never modifies the source database, media, DEV or running containers.
set -Eeuo pipefail
umask 077

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "$(pwd -P)" != "/opt/projects/ierc-rn" ||
      "$(git branch --show-current)" != "main" ]]; then
  echo "ABORT: execute only in /opt/projects/ierc-rn on main." >&2
  exit 2
fi
if [[ ! -s cms/.env.prod ]]; then
  echo "ABORT: cms/.env.prod is missing; never regenerate existing CMS credentials." >&2
  exit 2
fi
for tool in docker tar sha256sum date; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ABORT: missing required program: $tool" >&2
    exit 2
  fi
done

compose=(docker compose --env-file cms/.env.prod -f compose.cms.prod.yml)
"${compose[@]}" config --quiet
# Fail before backup if the already-running DEV PostgreSQL is not ready.
"${compose[@]}" exec -T db sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'
db_name=$("${compose[@]}" exec -T db sh -ec 'printf "%s" "$POSTGRES_DB"')
if [[ ! "$db_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ABORT: unexpected database name." >&2
  exit 2
fi

base="cms-backups"
mkdir -p "$base"
chmod 700 "$base"
destination="$base/prod-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$destination"

restore_id=""
cleanup() {
  if [[ -n "$restore_id" ]]; then
    docker rm -f "$restore_id" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[1/5] Saving a consistent logical PostgreSQL dump..."
"${compose[@]}" exec -T db sh -ec \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' \
  > "$destination/postgres.dump"
test -s "$destination/postgres.dump"

echo "[2/5] Saving media and the original CMS secret file (private directory)..."
"${compose[@]}" exec -T cms sh -ec \
  'exec tar -C /opt/app/public/uploads -czf - .' \
  > "$destination/uploads.tar.gz"
test -s "$destination/uploads.tar.gz"
cp cms/.env.prod "$destination/cms.env.prod"
chmod 600 "$destination/cms.env.prod"
tar -tzf "$destination/uploads.tar.gz" >/dev/null
"${compose[@]}" exec -T db pg_restore --list < "$destination/postgres.dump" >/dev/null
( cd "$destination" && sha256sum postgres.dump uploads.tar.gz cms.env.prod > SHA256SUMS )

echo "[3/5] Starting a temporary PostgreSQL 17 container with no network and no published ports..."
restore_id=$(docker run -d --rm --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine)
ready=false
for _ in $(seq 1 60); do
  if docker exec "$restore_id" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "FAILED: disposable PostgreSQL did not become ready." >&2
  exit 1
fi

echo "[4/5] Restoring dump to the disposable isolated database..."
docker exec -i "$restore_id" pg_restore \
  -U postgres -d postgres -C --no-owner --no-acl \
  < "$destination/postgres.dump"
tables=$(docker exec "$restore_id" psql -U postgres -d "$db_name" -Atqc \
  "select count(*) from information_schema.tables where table_schema='public'")
if ! [[ "$tables" =~ ^[0-9]+$ ]] || (( tables < 1 )); then
  echo "FAILED: restored database does not contain the expected CMS tables." >&2
  exit 1
fi

echo "[5/5] Restore rehearsal passed: $tables public tables in isolated database."
printf 'Restore rehearsal successful: database=%s, public_tables=%s\n' \
  "$db_name" "$tables" > "$destination/RESTORE_VERIFIED.txt"
echo "Backup directory: $PWD/$destination"
echo "Contains sensitive CMS credentials: keep private, back up off-host encrypted, never commit."
echo "The disposable database is removed on exit. DEV and the running CMS PROD/uploads are unchanged."
