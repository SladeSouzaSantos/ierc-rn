#!/usr/bin/env bash
# Read-only operator verification. NEVER echo env contents or tokens.
set -euo pipefail
mode="${1:-}"
if [[ "$mode" != dev && "$mode" != prod ]]; then
  echo "Usage: bash scripts/security-preflight.sh dev|prod" >&2
  exit 2
fi
expected_branch=dev
env_file=deploy/.env.portal.dev
compose=compose.portal.dev.yml
portal_port=3101
cms_port=1337
site=https://dev.iercrn.org.br
if [[ "$mode" == prod ]]; then
  expected_branch=main
  env_file=deploy/.env.portal.prod
  compose=compose.portal.prod.yml
  portal_port=3102
  cms_port=1338
  site=https://iercrn.org.br
fi
if [[ "$(git branch --show-current)" != "$expected_branch" ]]; then
  echo "FAIL: expected branch $expected_branch" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "WARN: local Git changes exist; review before updating or merging"
fi
echo "Checking $mode read-only runtime: $site (no credentials printed)"
if ! command -v docker >/dev/null || ! command -v curl >/dev/null; then
  echo "FAIL: docker and curl are required" >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "FAIL: private portal env file missing: $env_file" >&2
  exit 1
fi
for file in "$env_file" "cms/.env.$mode" "curator/.env.$mode"; do
  if [[ ! -f "$file" ]]; then
    echo "WARN: optional component config not present: $file"
    continue
  fi
  perm="$(stat -c %a "$file")"
  if (( (8#$perm & 077) != 0 )); then
    echo "FAIL: $file must not be accessible to group/other (chmod 600)" >&2
    exit 1
  fi
done
docker compose --env-file "$env_file" -f "$compose" config --quiet >/dev/null
echo "PASS: compose config parses; private file permissions"
local_status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$portal_port/instituto" || true)"
[[ "$local_status" == 200 ]] || { echo "FAIL: local portal expected 200, got $local_status" >&2; exit 1; }
public_status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' "$site/instituto" || true)"
[[ "$public_status" == 200 ]] || { echo "FAIL: HTTPS portal expected 200, got $public_status" >&2; exit 1; }
echo "PASS: local and HTTPS /instituto returned 200"
cms_status="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$cms_port/api/news-articles" || true)"
if [[ "$cms_status" != 401 && "$cms_status" != 403 ]]; then
  echo "FAIL: anonymous CMS API should reject access, got $cms_status" >&2
  exit 1
fi
echo "PASS: anonymous CMS API rejected ($cms_status)"
headers="$(curl -sSI --max-time 12 "$site/instituto" | tr -d '\r' || true)"
for name in x-frame-options x-content-type-options content-security-policy; do
  if ! printf '%s\n' "$headers" | grep -qi "^$name:"; then
    echo "FAIL: missing $name on HTTPS public response" >&2
    exit 1
  fi
done
echo "PASS: baseline browser headers present"
echo "MANUAL GATES: Cloudflare Access on Strapi admin; MFA; scoped token review;"
echo "  verified off-host backup AND restore test; Docker image versions; worker publish flags;"
echo "  TLS/HTTP security evaluation and assisted accessibility review."
echo "This command performs only GET/HEAD and read-only local inspections."
