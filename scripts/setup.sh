#!/usr/bin/env bash
# One-shot bootstrap for a fresh clone:
#   - install workspace deps
#   - copy .env.example → .env (idempotent — never overwrites real keys)
#   - create a local Postgres database if psql is available
#   - run migrations
#
# Usage: ./scripts/setup.sh   or   npm run setup

set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

c_dim()   { printf "\033[2m%s\033[0m\n" "$*"; }
c_green() { printf "\033[32m%s\033[0m\n" "$*"; }
c_yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }

step() { printf "\n\033[1m→ %s\033[0m\n" "$*"; }

# ── 1. node version sanity check ───────────────────────────────────────────
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if (( NODE_MAJOR < 20 )); then
  echo "error: Node 20+ required (found v$(node -v 2>/dev/null || echo 'none'))" >&2
  exit 1
fi

# ── 2. install workspace deps ──────────────────────────────────────────────
step "installing workspace dependencies"
npm --prefix server   install --no-audit --no-fund --silent
npm --prefix frontend install --no-audit --no-fund --silent
c_green "  ✓ deps installed"

# ── 3. seed .env files from examples (never overwrite) ─────────────────────
step "scaffolding .env files"
for pair in "server/.env.example:server/.env" "frontend/.env.example:frontend/.env"; do
  src=${pair%%:*}; dst=${pair##*:}
  if [[ -f "$dst" ]]; then
    c_dim "  • $dst already exists, leaving it alone"
  else
    cp "$src" "$dst"
    c_green "  ✓ created $dst (edit before running paid-API features)"
  fi
done

# ── 4. local Postgres (best effort) ────────────────────────────────────────
step "checking for a local Postgres"
PSQL=$(command -v psql || true)
if [[ -z "$PSQL" ]]; then
  for c in /opt/homebrew/opt/postgresql@16/bin/psql /usr/local/opt/postgresql@16/bin/psql /usr/lib/postgresql/16/bin/psql; do
    [[ -x "$c" ]] && PSQL="$c" && break
  done
fi
CREATEDB=""
if [[ -n "$PSQL" ]]; then
  CREATEDB="$(dirname "$PSQL")/createdb"
fi

if [[ -z "$PSQL" ]]; then
  c_yellow "  ! psql not found. Install Postgres 14+ then re-run this script."
  c_yellow "    macOS: brew install postgresql@16 && brew services start postgresql@16"
  c_yellow "    Linux: apt install postgresql-16 && sudo systemctl start postgresql"
  c_yellow "  Skipping DB creation + migrations."
  exit 0
fi

# Pull DATABASE_URL from server/.env so we operate on whatever the user set.
DATABASE_URL=$(grep -E '^DATABASE_URL=' server/.env | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' || true)
if [[ -z "$DATABASE_URL" ]]; then
  c_yellow "  ! DATABASE_URL is empty in server/.env — skipping DB setup."
  exit 0
fi

# Probe the URL. If unreachable, tell the user; if reachable but missing, create.
# Mask password in user-visible URLs (postgres://user:***@host/db).
mask_url() { echo "$1" | sed -E 's|(://[^:]+):[^@]+@|\1:***@|'; }
SAFE_URL=$(mask_url "$DATABASE_URL")

if "$PSQL" "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
  c_green "  ✓ database reachable ($SAFE_URL)"
else
  # Try to extract dbname + admin URL (postgres db on same host) so we can createdb.
  DBNAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^/?]+).*|\1|')
  ADMIN_URL=$(echo "$DATABASE_URL" | sed -E "s|/${DBNAME}([?].*)?$|/postgres\\1|")
  if "$PSQL" "$ADMIN_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    c_dim "  • creating database $DBNAME"
    "$CREATEDB" -h "$(echo "$ADMIN_URL" | sed -E 's|.*@([^:/]+).*|\1|')" "$DBNAME" 2>/dev/null || \
      "$PSQL" "$ADMIN_URL" -c "CREATE DATABASE \"$DBNAME\";" >/dev/null
    c_green "  ✓ database $DBNAME created"
  else
    c_yellow "  ! cannot reach Postgres at $SAFE_URL"
    c_yellow "    is the server running? (macOS: brew services start postgresql@16)"
    exit 0
  fi
fi

# ── 5. migrations ──────────────────────────────────────────────────────────
step "applying migrations"
npm --prefix server run migrate >/dev/null
c_green "  ✓ migrations applied"

# ── 6. final guidance ──────────────────────────────────────────────────────
cat <<'EOF'

✓ setup complete.

  start it:           npm run dev          # backend + frontend together
  open the app:       http://localhost:8080
  run the tests:      npm test

What works without paid keys:
  ✓ auth (signup / login)        ✓ in-browser MediaPipe pose scoring
  ✓ session list, goals, badges  ✓ video upload (needs R2 keys)
  ✗ /api/twelvelabs/* (needs TWELVELABS_API_KEY)
  ✗ /api/coach/*      (needs ANTHROPIC_API_KEY)

EOF
