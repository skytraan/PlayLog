#!/usr/bin/env bash
# Build the frontend, serve it via vite preview, run a Lighthouse audit,
# print the four category scores.

set -euo pipefail
source "$(dirname "$0")/env.sh"

echo "→ vite build"
(cd "$REPO_ROOT/frontend" && npx --yes vite build >/dev/null)

if [[ -f "$BENCH_PREVIEW_PID_FILE" ]] && kill -0 "$(cat "$BENCH_PREVIEW_PID_FILE")" 2>/dev/null; then
  echo "→ preview already running"
else
  if lsof -ti ":$BENCH_PREVIEW_PORT" >/dev/null 2>&1; then
    echo "error: port $BENCH_PREVIEW_PORT already in use" >&2
    exit 1
  fi
  echo "→ starting vite preview on :$BENCH_PREVIEW_PORT"
  (cd "$REPO_ROOT/frontend" && nohup npx --yes vite preview --port "$BENCH_PREVIEW_PORT" \
     >"$BENCH_PREVIEW_LOG" 2>&1 & echo $! > "$BENCH_PREVIEW_PID_FILE")
fi

DEADLINE=$(( $(date +%s) + 30 ))
until curl -sf "http://localhost:$BENCH_PREVIEW_PORT/" >/dev/null; do
  if (( $(date +%s) > DEADLINE )); then
    echo "error: preview did not become ready in 30s" >&2
    tail -40 "$BENCH_PREVIEW_LOG" >&2
    exit 1
  fi
  sleep 1
done

OUT="$BENCH_DIR/lighthouse.json"
echo "→ running lighthouse (desktop, headless)"
npx --yes lighthouse "http://localhost:$BENCH_PREVIEW_PORT/" \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet \
  --output=json \
  --output-path="$OUT" \
  --chrome-flags="--headless=new --no-sandbox" >/dev/null

node -e "
  const d = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const pct = (s) => (s == null ? 'n/a' : Math.round(s * 100) + '/100');
  console.log('=== Lighthouse (desktop) ===');
  for (const k of Object.keys(d.categories)) {
    const c = d.categories[k];
    console.log((c.title + ':').padEnd(20), pct(c.score));
  }
  console.log();
  console.log('=== Web Vitals ===');
  for (const [key, label] of [['first-contentful-paint','FCP'],['largest-contentful-paint','LCP'],['total-blocking-time','TBT'],['cumulative-layout-shift','CLS'],['speed-index','Speed Index'],['interactive','TTI']]) {
    const a = d.audits[key];
    console.log(label.padEnd(14), (a && a.displayValue) || 'n/a');
  }
" "$OUT"

echo
echo "✓ full report: $OUT"
