#!/usr/bin/env bash
# Query-scaling bench: top up sessions to 20, 100, 1000 and measure
# listSessionsWithFeedback at each step.

set -euo pipefail
source "$(dirname "$0")/env.sh"
require_psql

if [[ ! -f "$BENCH_TOKEN_FILE" || ! -f "$BENCH_USER_FILE" ]]; then
  echo "error: token/user not seeded — run bench/start-server.sh first." >&2
  exit 1
fi
TOKEN=$(cat "$BENCH_TOKEN_FILE")
USER_ID=$(cat "$BENCH_USER_FILE")

bench() {
  npx --yes autocannon -d 10 -c "$BENCH_CONNECTIONS" -m POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -b '{}' \
    "$BENCH_HOST/api/sessions/listSessionsWithFeedback" 2>&1 \
    | grep -E "Latency|Req/Sec|Bytes/Sec" | head -10
}

top_up_sessions_to() {
  local target=$1
  local cur=$("$PSQL" "$BENCH_DATABASE_URL" -tAc "SELECT count(*) FROM sessions WHERE user_id='$USER_ID';" | tr -d ' ')
  local need=$((target - cur))
  if (( need > 0 )); then
    "$PSQL" "$BENCH_DATABASE_URL" -c "
      INSERT INTO sessions (user_id, sport, video_storage_id, requested_sections, status, created_at)
      SELECT '$USER_ID','basketball','videos/seed-'||gs,ARRAY['shooting','footwork'],'complete',
             (extract(epoch from now())*1000)::bigint+gs
      FROM generate_series(1, $need) gs;" >/dev/null
  fi
}

# For ~half the sessions, also create matching analyses + feedback rows so the
# lateral subqueries actually return joined data (mirrors prod shape).
top_up_joined_to() {
  local target=$1
  local cur_a=$("$PSQL" "$BENCH_DATABASE_URL" -tAc "
    SELECT count(*) FROM analyses a JOIN sessions s ON s.id=a.session_id
    WHERE s.user_id='$USER_ID';" | tr -d ' ')
  local need=$((target - cur_a))
  if (( need > 0 )); then
    "$PSQL" "$BENCH_DATABASE_URL" -c "
      INSERT INTO analyses (session_id, overall_score, technique, created_at)
      SELECT id, random()*100, 'good', (extract(epoch from now())*1000)::bigint
      FROM sessions WHERE user_id='$USER_ID' AND id NOT IN (SELECT session_id FROM analyses)
      LIMIT $need;" >/dev/null
    "$PSQL" "$BENCH_DATABASE_URL" -c "
      INSERT INTO feedback (session_id, analysis_id, summary, strengths, improvements, drills, created_at)
      SELECT a.session_id, a.id, 'good work', ARRAY['form'], ARRAY['speed'], ARRAY['drill1'],
             (extract(epoch from now())*1000)::bigint
      FROM analyses a JOIN sessions s ON s.id=a.session_id
      WHERE s.user_id='$USER_ID' AND a.id NOT IN (SELECT analysis_id FROM feedback)
      LIMIT $need;" >/dev/null
  fi
}

for n in 20 100 1000; do
  echo "===== $n sessions ====="
  top_up_sessions_to "$n"
  top_up_joined_to $((n / 2))
  "$PSQL" "$BENCH_DATABASE_URL" -tAc "SELECT count(*) FROM sessions WHERE user_id='$USER_ID';" | xargs printf "  sessions: %s\n"
  bench
  echo
done
