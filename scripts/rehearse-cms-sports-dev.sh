#!/usr/bin/env bash
# IERC-RN: isolated DEV Strapi schema rehearsal on a disposable DB restored
# from a VERIFIED backup. No live CMS, PostgreSQL volume or host port touched.
set -Eeuo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"

abort() { printf 'ABORT: %s\n' "$*" >&2; exit 2; }
dc() { docker compose --env-file cms/.env -f compose.cms.yml "$@"; }
[[ "$(git branch --show-current)" == "dev" ]] || abort "Only dev is permitted"
[[ $# -eq 1 ]] || abort "Usage: bash scripts/rehearse-cms-sports-dev.sh cms-backups/dev-YYYYMMDDThhmmssZ"
[[ "$1" =~ ^cms-backups/dev-[0-9]{8}T[0-9]{6}Z$ ]] || abort "Invalid backup path"
backup="$1"
[[ -s "$backup/postgres.dump" && -s "$backup/SHA256SUMS" &&
   -s "$backup/RESTORE_VERIFIED.txt" && -s cms/.env ]] || abort "Backup or private env is missing"
(cd "$backup" && sha256sum --status -c SHA256SUMS) || abort "Backup checksum failed"
grep -q '^Restore rehearsal successful:' "$backup/RESTORE_VERIFIED.txt" ||
  abort "Backup was not restored successfully"
dc config --quiet
live_db=$(dc ps -q db)
live_cms=$(dc ps -q cms)
[[ -n "$live_db" && -n "$live_cms" ]] || abort "Live DEV CMS or DB missing"
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$live_db")" == healthy ]] ||
  abort "Live DEV database not healthy"
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$live_cms")" == healthy ]] ||
  abort "Live DEV CMS not healthy"
dbname=$(dc exec -T db sh -ec 'printf "%s" "$POSTGRES_DB"')
[[ "$dbname" =~ ^[a-zA-Z_][a-zA-Z_0-9]*$ ]] || abort "Invalid database name"

run="$$"
net="ierc-cms-sports-sandbox-net-$run"
db="ierc-cms-sports-sandbox-db-$run"
app="ierc-cms-sports-sandbox-app-$run"
image="ierc-cms-sports-sandbox:$(git rev-parse --short=9 HEAD)"
net_created=0
db_created=0
app_created=0
image_built=0
cleanup() {
  code=$?
  trap - EXIT
  if [[ "$app_created" == 1 ]]; then docker rm -f "$app" >/dev/null 2>&1 || true; fi
  if [[ "$db_created" == 1 ]]; then docker rm -f "$db" >/dev/null 2>&1 || true; fi
  if [[ "$net_created" == 1 ]]; then docker network rm "$net" >/dev/null 2>&1 || true; fi
  if [[ "$image_built" == 1 ]]; then docker image rm "$image" >/dev/null 2>&1 || true; fi
  printf 'SANDBOX_CLEANUP=COMPLETE\n'
  exit "$code"
}
trap cleanup EXIT

printf 'BACKUP_INTEGRITY=OK\nLIVE_CMS_AND_DB=HEALTHY\n'
# --internal blocks external access. Only the following two ephemeral
# containers join this network; neither publishes ports to the host.
docker network create --internal "$net" >/dev/null
net_created=1
docker run -d --rm --name "$db" --network "$net" --network-alias db \
  --label ierc-rn-purpose=cms-sports-sandbox \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
db_created=1
ready=0
for _ in $(seq 1 70); do
  if docker exec "$db" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || abort "Scratch PostgreSQL not ready"
docker exec -i "$db" pg_restore -U postgres -d postgres -C --no-owner --no-acl \
  < "$backup/postgres.dump" >/dev/null
sql() { docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$dbname" -Atqc "$1"; }
baseline=$(sql "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[[ "$baseline" =~ ^[0-9]+$ && "$baseline" -ge 1 ]] || abort "Scratch restoration invalid"
baseline_recorded=$(sed -n 's/.*public_tables=\([0-9][0-9]*\).*/\1/p' "$backup/RESTORE_VERIFIED.txt")
[[ "$baseline" == "$baseline_recorded" ]] || abort "Sandbox table count differs from verified restore"
[[ "$(sql "SELECT to_regclass('public.ierc_events') IS NOT NULL")" == t ]] ||
  abort "Existing institutional event table not restored"
[[ "$(sql "SELECT to_regclass('public.ierc_sport_competitions') IS NULL")" == t ]] ||
  abort "Sports table already present in backup"
events_before=$(sql 'SELECT count(*) FROM public.ierc_events')
tables_before=$(sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
printf 'SANDBOX_TABLES_BEFORE=%s\n' "$baseline"

# Candidate image build does not use a running Compose stack.
# cms/.dockerignore excludes private env files from image construction.
docker build --pull=false -t "$image" -f cms/Dockerfile cms >/dev/null
image_built=1
printf 'CANDIDATE_IMAGE_BUILT=YES\n'
# Reuse runtime app settings but ALWAYS override the DB address/credentials
# to the isolated scratch PostgreSQL. The sandbox has no published ports.
docker run -d --rm --name "$app" --network "$net" \
  --label ierc-rn-purpose=cms-sports-sandbox \
  --env-file cms/.env \
  -e DATABASE_HOST=db -e DATABASE_NAME="$dbname" \
  -e DATABASE_PORT=5432 -e DATABASE_USERNAME=postgres \
  -e DATABASE_PASSWORD=sandbox-only -e DATABASE_SSL=false \
  -e CMS_INSTANCE_KIND=dev -e CMS_DIAGNOSTIC_UNSAFE_EVAL=false \
  -e PUBLIC_URL=http://127.0.0.1:1337 \
  -e NODE_ENV=production \
  --cap-drop ALL --security-opt no-new-privileges \
  "$image" >/dev/null
app_created=1
ready=0
for _ in $(seq 1 90); do
  if docker exec "$app" node -e \
      'fetch("http://127.0.0.1:1337/_health",{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' \
       >/dev/null 2>&1; then ready=1; break; fi
  [[ "$(docker inspect -f '{{.State.Running}}' "$app")" == true ]] || break
  sleep 3
done
[[ "$ready" == 1 ]] || abort "Candidate Strapi did not become healthy in sandbox"

after=$(sql "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[[ "$after" =~ ^[0-9]+$ && "$after" -gt "$baseline" ]] ||
  abort "No new SQL tables appeared in sandbox"
[[ "$(sql "SELECT to_regclass('public.ierc_sport_competitions') IS NOT NULL")" == t ]] ||
  abort "Sport competitions table not created"
[[ "$(sql "SELECT to_regclass('public.ierc_events') IS NOT NULL")" == t ]] ||
  abort "Institutional events table missing after migration"
events_after=$(sql 'SELECT count(*) FROM public.ierc_events')
[[ "$events_before" == "$events_after" ]] || abort "Existing event rows changed"
tables_after=$(sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
missing=$(comm -23 <(printf '%s\n' "$tables_before" | sort) \
  <(printf '%s\n' "$tables_after" | sort))
[[ -z "$missing" ]] || abort "At least one previous table disappeared"
[[ "$(dc ps -q db)" == "$live_db" && "$(dc ps -q cms)" == "$live_cms" ]] ||
  abort "Original DEV services changed unexpectedly"
printf 'SANDBOX_CMS=HEALTHY\nSANDBOX_TABLES_AFTER=%s\n' "$after"
printf 'SANDBOX_NEW_SPORT_COLLECTION=CREATED\n'
printf 'SANDBOX_EXISTING_TABLES=PRESERVED\n'
printf 'SANDBOX_EVENT_ROWS=PRESERVED\n'
printf 'LIVE_DEV_CONTAINERS=UNCHANGED\nSANDBOX_REHEARSAL=PASS\n'
