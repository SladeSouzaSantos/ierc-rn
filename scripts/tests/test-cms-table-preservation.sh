#!/usr/bin/env bash
# Isolated regression: SQL lexical order, host collation, and prefixes must
# not change the answer. Does not need Node, Docker or a database.
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"
source scripts/lib/cms-table-preservation.sh

before=$'ierc_events\nierc_site_settings\nstrapi_administrator'
reordered=$'strapi_administrator\nierc_sport_competitions\nierc_site_settings\nierc_events'
cms_tables_preserved "$before" "$reordered"
echo 'SPORTS_TABLE_SET_ORDER_INDEPENDENT=PASS'

if cms_tables_preserved "$before" $'ierc_events\nierc_site_settings\nstrapi_administrator_old'; then
  echo 'FAIL: mistook prefix for exact table name' >&2
  exit 1
fi
if cms_tables_preserved "$before" $'ierc_events\nierc_sport_competitions\nstrapi_administrator'; then
  echo 'FAIL: missing old table not detected' >&2
  exit 1
fi
if cms_tables_preserved $'ierc_events\n' "$reordered"; then
  echo 'FAIL: accepted malformed original list' >&2
  exit 1
fi
if cms_tables_preserved "" "$reordered"; then
  echo 'FAIL: accepted empty original list' >&2
  exit 1
fi
echo 'SPORTS_TABLE_SET_REGRESSION=PASS'
