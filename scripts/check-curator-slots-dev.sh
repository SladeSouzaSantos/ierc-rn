#!/usr/bin/env bash
# Read-only inspection of the DEV schedule and 48h Redis slot claims.
# Never display .env, docker inspect Env, CMS data, or Redis values.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == dev ]] || {
  echo "SCHEDULE_CHECK_DENIED: use the DEV checkout" >&2; exit 1;
}
[[ -f curator/.env ]] || { echo "DEV curator/.env missing" >&2; exit 1; }
compose=(docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator)
date_local="$(TZ=America/Fortaleza date +%F)"
echo "=== Curator DEV slot diagnostics (America/Fortaleza) ==="
echo "Date: $date_local"
echo "=== Persistent worker status (no environment variables printed) ==="
docker inspect ierc-rn-curator-dev-worker-1 \
  --format '{{.Name}} | state={{.State.Status}} | started_utc={{.State.StartedAt}} | restarts={{.RestartCount}}'
echo "=== Redis slot claims (EXISTS/TTL only) ==="
for hour in 08 13 19; do
  key="ierc:curator:job:$date_local:$hour"
  exists="$("${compose[@]}" exec -T redis redis-cli --raw EXISTS "$key")"
  ttl="$("${compose[@]}" exec -T redis redis-cli --raw TTL "$key")"
  case "$exists" in 0|1) ;; *)
    echo "SCHEDULE_CHECK_FAILED: unexpected Redis response" >&2; exit 1;; esac
  case "$ttl" in -2|-1|[0-9]*) ;; *)
    echo "SCHEDULE_CHECK_FAILED: unexpected TTL response" >&2; exit 1;; esac
  echo "slot=$hour | claimed=$exists | ttl_seconds=$ttl"
done
echo "=== Recent schedule outcomes (last 8 hours, latest 80 lines) ==="
"${compose[@]}" logs --since=8h --tail=80 worker |
  grep -E '"event":"(schedule_started|schedule_slot_claimed|schedule_slot_skipped|schedule_error|run_completed|run_failed)"' || true

echo "A Redis claim proves the slot was reserved, NOT that publication succeeded."
echo "If the slot is not claimed after its local window, inspect worker uptime/restarts."
