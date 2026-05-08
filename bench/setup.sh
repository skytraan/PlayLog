#!/usr/bin/env bash
# Create the bench DB, apply migrations, ensure a seeded user + 20 sessions.
# Idempotent: safe to re-run.

set -euo pipefail
source "$(dirname "$0")/env.sh"
require_psql

if ! "$PSQL" -h "$BENCH_DB_HOST" -p "$BENCH_DB_PORT" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$BENCH_DB_NAME'" | grep -q 1; then
  echo "→ creating database $BENCH_DB_NAME"
  "$CREATEDB" -h "$BENCH_DB_HOST" -p "$BENCH_DB_PORT" "$BENCH_DB_NAME"
else
  echo "→ database $BENCH_DB_NAME already exists"
fi

echo "→ running migrations"
(cd "$REPO_ROOT/server" && npm run migrate >/dev/null)

# Seed bench user via direct SQL (bypasses HTTP — server may not be running yet).
USER_ID=$("$PSQL" "$BENCH_DATABASE_URL" -tAc "
  WITH ins AS (
    INSERT INTO users (name, email, sports, created_at)
    VALUES ('Bench User', 'bench@local.test', ARRAY['basketball'], (extract(epoch from now())*1000)::bigint)
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT id FROM ins UNION ALL SELECT id FROM users WHERE email='bench@local.test' LIMIT 1;
")
echo "$USER_ID" > "$BENCH_USER_FILE"
echo "→ user $USER_ID"

# Top up to 20 sessions for the bench user.
EXISTING=$("$PSQL" "$BENCH_DATABASE_URL" -tAc "SELECT count(*) FROM sessions WHERE user_id='$USER_ID';")
NEED=$((20 - EXISTING))
if (( NEED > 0 )); then
  "$PSQL" "$BENCH_DATABASE_URL" -c "
    INSERT INTO sessions (user_id, sport, video_storage_id, requested_sections, status, created_at)
    SELECT '$USER_ID', 'basketball', 'videos/seed-' || gs,
           ARRAY['shooting','footwork'], 'complete',
           (extract(epoch from now())*1000)::bigint + gs
    FROM generate_series(1, $NEED) gs;" >/dev/null
  echo "→ seeded $NEED sessions (now 20 total)"
else
  echo "→ already 20+ sessions"
fi

echo "✓ setup complete  ($BENCH_DATABASE_URL)"
