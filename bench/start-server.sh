#!/usr/bin/env bash
# Boot the API server in the background, write its PID to bench/.server.pid,
# wait until /health responds.

set -euo pipefail
source "$(dirname "$0")/env.sh"

if [[ -f "$BENCH_PID_FILE" ]] && kill -0 "$(cat "$BENCH_PID_FILE")" 2>/dev/null; then
  echo "→ server already running (pid $(cat "$BENCH_PID_FILE"))"
  exit 0
fi

if lsof -ti ":$BENCH_API_PORT" >/dev/null 2>&1; then
  echo "error: port $BENCH_API_PORT already in use" >&2
  exit 1
fi

echo "→ starting server on :$BENCH_API_PORT"
(cd "$REPO_ROOT/server" && nohup npx tsx src/index.ts >"$BENCH_LOG" 2>&1 &
  echo $! > "$BENCH_PID_FILE")

DEADLINE=$(( $(date +%s) + 30 ))
until curl -sf "$BENCH_HOST/health" >/dev/null 2>&1; do
  if (( $(date +%s) > DEADLINE )); then
    echo "error: server did not become ready in 30s. Logs:" >&2
    tail -40 "$BENCH_LOG" >&2
    exit 1
  fi
  sleep 1
done
echo "✓ server ready ($BENCH_HOST)"

# Make sure the bench user has a fresh JWT for authed scenarios.
SIGNUP=$(curl -s -X POST "$BENCH_HOST/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bench User","email":"bench@local.test","sports":["basketball"]}')
echo "$SIGNUP" | node -e "
  let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
    const j=JSON.parse(s); if(!j.token){console.error('signup failed:',s);process.exit(1)}
    require('fs').writeFileSync(process.argv[1], j.token);
    require('fs').writeFileSync(process.argv[2], j.user._id);
  });
" "$BENCH_TOKEN_FILE" "$BENCH_USER_FILE"
echo "✓ token issued"
