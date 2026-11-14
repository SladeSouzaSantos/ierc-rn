#!/usr/bin/env bash
# DEV only. Generate a dedicated AES-256 editorial history key locally, once.
# Never print, export to logs, commit, rotate silently or use a CMS/LLM token.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == "dev" ]] || {
  echo "PROGRESS_KEY_DENIED: DEV checkout required" >&2; exit 1;
}
[[ -f curator/.env ]] || {
  echo "PROGRESS_KEY_DENIED: curator/.env is missing" >&2; exit 1;
}
python3 - <<'PY'
from pathlib import Path
from secrets import token_hex
import re

p = Path("curator/.env")
lines = p.read_text(encoding="utf-8").splitlines()
matches = [i for i, line in enumerate(lines)
           if line.startswith("CURATOR_EDITORIAL_PROGRESS_KEY=")]
if len(matches) > 1:
    raise SystemExit("PROGRESS_KEY_DENIED: duplicate key definitions")
if matches:
    i = matches[0]
    value = lines[i].partition("=")[2]
    if not value:
        lines[i] = "CURATOR_EDITORIAL_PROGRESS_KEY=" + token_hex(32)
    elif not re.fullmatch(r"[0-9a-fA-F]{64}", value):
        raise SystemExit("PROGRESS_KEY_DENIED: existing key must be 64 hex characters")
else:
    lines.append("CURATOR_EDITORIAL_PROGRESS_KEY=" + token_hex(32))
p.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")
p.chmod(0o600)
print("DEV_EDITORIAL_PROGRESS_KEY_READY (secret not displayed)")
PY
