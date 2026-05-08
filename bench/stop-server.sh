#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

for f in "$BENCH_PID_FILE" "$BENCH_PREVIEW_PID_FILE"; do
  if [[ -f "$f" ]]; then
    pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      echo "→ stopped pid $pid ($(basename "$f"))"
    fi
    rm -f "$f"
  fi
done
