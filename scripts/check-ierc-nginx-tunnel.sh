#!/usr/bin/env bash
# Read-only preflight and smoke test; never reads or logs tunnel tokens.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== IERC edge: config ==="
docker compose -f compose.nginx.yml config --quiet

echo "=== Cloudflared network mode (expected: host) ==="
docker inspect cloudflared --format '{{.HostConfig.NetworkMode}}'

echo "=== External Docker networks ==="
for network in ierc-rn-main-edge ierc-rn-dev-edge; do
  docker network inspect "$network" --format '{{.Name}} {{.Driver}}' >/dev/null ||
    { echo "MISSING_NETWORK: $network" >&2; exit 1; }
  echo "NETWORK_OK: $network"
done

echo "=== IERC proxy container ==="
docker compose -f compose.nginx.yml ps

echo "=== Direct portal routes through local Nginx ==="
for hostname in iercrn.org.br dev.iercrn.org.br; do
  code="$(curl --silent --show-error --max-time 15 --output /dev/null \
    --write-out '%{http_code}' --header "Host: $hostname" \
    http://127.0.0.1:18081/)"
  echo "$hostname: HTTP $code"
  case "$code" in
    200|301|302|307|308) ;;
    *) echo "NGINX_ROUTE_FAILED: $hostname" >&2; exit 1;;
  esac
done

echo "IERC_NGINX_TUNNEL_LOCAL_OK: both domains resolve through localhost Nginx"
echo "Cloudflare dashboard/DNS/Access must be validated separately."
