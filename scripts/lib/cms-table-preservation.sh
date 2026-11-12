#!/usr/bin/env bash
# Pure, order-independent set containment for PostgreSQL public table names.
# The live schema comparison is performed only on the disposable sandbox DB.
# No Docker access, SQL writes, files or network required.
cms_tables_preserved() {
  [[ "$#" -eq 2 ]] || return 2
  local before="$1" after="$2" table
  [[ -n "$before" && -n "$after" ]] || return 1
  while IFS= read -r table; do
    # Strapi-created table identifiers are ASCII SQL identifiers.
    # Reject empty/malformed names rather than accepting ambiguous lists.
    [[ "$table" =~ ^[A-Za-z_][A-Za-z_0-9]*$ ]] || return 1
    grep -Fqx -- "$table" <<< "$after" || return 1
  done <<< "$before"
}
