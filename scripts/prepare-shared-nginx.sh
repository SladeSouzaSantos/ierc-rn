#!/usr/bin/env bash
# Copy the correct vhost into this checkout's locally ignored nginx.conf.
# Does NOT reload or alter the global nginx-proxy.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  main)
    [[ "$(basename "$PWD")" == "ierc-rn" ]] ||
      { echo "Run MAIN in /opt/projects/ierc-rn" >&2; exit 1; }
    source_file=infra/nginx/shared-main.conf ;;
  dev)
    [[ "$(basename "$PWD")" == "ierc-rn-dev" ]] ||
      { echo "Run DEV in /opt/projects/ierc-rn-dev" >&2; exit 1; }
    source_file=infra/nginx/shared-dev.conf ;;
  *)
    echo "Usage: bash scripts/prepare-shared-nginx.sh main|dev" >&2
    exit 2 ;;
esac
if [[ -e nginx.conf ]]; then
  if cmp -s nginx.conf "$source_file"; then
    echo "NGINX_VHOST_ALREADY_CURRENT: $PWD/nginx.conf"
    exit 0
  fi
  echo "Refusing to overwrite an existing nginx.conf; compare/backup it manually." >&2
  exit 1
fi
cp -- "$source_file" nginx.conf
chmod 644 nginx.conf
echo "NGINX_VHOST_PREPARED: $PWD/nginx.conf"
echo "This does not change the running proxy. Verify include/mounts, then nginx -t and reload."
