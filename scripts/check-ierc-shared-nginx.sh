#!/usr/bin/env bash
# Read-only checks: does not enumerate environment variables or tunnel credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Existing nginx-proxy network(s) ==="
docker inspect nginx-proxy --format '{{range $name,$network:=.NetworkSettings.Networks}}{{println $name}}{{end}}'
echo "=== Cloudflared network mode ==="
docker inspect cloudflared --format '{{.HostConfig.NetworkMode}}'

echo "=== Nginx vhosts visible in the running proxy configuration ==="
# Capture only locally; print neither unrelated config nor secrets.
loaded="$(docker exec nginx-proxy nginx -T 2>/dev/null)"
for host in iercrn.org.br dev.iercrn.org.br; do
  if ! grep -Fq "server_name $host;" <<<"$loaded"; then
    echo "VHOST_NOT_LOADED: $host; check shared include and mounts" >&2
    exit 1
  fi
  echo "VHOST_LOADED: $host"
done

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
