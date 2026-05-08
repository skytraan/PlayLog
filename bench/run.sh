#!/usr/bin/env bash
# Three autocannon scenarios against a running bench server.
# Assumes bench/setup.sh and bench/start-server.sh have run.

set -euo pipefail
source "$(dirname "$0")/env.sh"

if [[ ! -f "$BENCH_TOKEN_FILE" ]]; then
  echo "error: $BENCH_TOKEN_FILE missing — run bench/start-server.sh first." >&2
  exit 1
fi
TOKEN=$(cat "$BENCH_TOKEN_FILE")

D=$BENCH_DURATION
C=$BENCH_CONNECTIONS

echo "===== /health  (Hono framework baseline) ====="
npx --yes autocannon -d "$D" -c "$C" "$BENCH_HOST/health"

echo
echo "===== /api/auth/login  (DB read + JWT sign) ====="
npx --yes autocannon -d "$D" -c "$C" -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"bench@local.test"}' \
  "$BENCH_HOST/api/auth/login"

echo
echo "===== /api/sessions/listSessionsWithFeedback  (JWT verify + lateral subqueries) ====="
npx --yes autocannon -d "$D" -c "$C" -m POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -b '{}' \
  "$BENCH_HOST/api/sessions/listSessionsWithFeedback"
