#!/usr/bin/env bash
# Read-only checks: does not enumerate environment variables or tunnel credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Existing nginx-proxy network(s) ==="
docker inspect nginx-proxy --format '{{range $name,$network:=.NetworkSettings.Networks}}{{println $name}}{{end}}'
echo "=== Cloudflared network mode ==="
docker inspect cloudflared --format '{{.HostConfig.NetworkMode}}'

echo "=== Nginx vhosts visible in the running proxy configuration ==="
docker exec nginx-proxy nginx -T 2>/dev/null |
  grep -E 'server_name (iercrn\.org\.br|dev\.iercrn\.org\.br);' || {
    echo "VHOST_NOT_LOADED: verify /opt/projects/*/nginx.conf is mounted and included" >&2
    exit 1
  }

echo "=== Routing through the ORIGINAL proxy, port 80 ==="
for host in iercrn.org.br dev.iercrn.org.br; do
  code="$(curl --silent --show-error --max-time 15 --output /dev/null \
    --write-out '%{http_code}' --header "Host: $host" http://127.0.0.1:80/)"
  echo "$host: HTTP $code"
  case "$code" in
    200|301|302|307|308) ;;
    *) echo "SHARED_PROXY_ROUTE_FAILED: $host" >&2; exit 1;;
  esac
done
echo "IERC_SHARED_PROXY_OK: original nginx-proxy serves both portals"
echo "Cloudflare DNS/Access and CMS published routes still require external checks."
