# Sourced by every other script in bench/.
# Override any variable via the shell before running.

BENCH_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$BENCH_DIR/.." && pwd)

: "${BENCH_DB_NAME:=playlog_bench}"
: "${BENCH_DB_HOST:=localhost}"
: "${BENCH_DB_PORT:=5432}"
: "${BENCH_DB_USER:=$USER}"
: "${BENCH_DATABASE_URL:=postgres://${BENCH_DB_USER}@${BENCH_DB_HOST}:${BENCH_DB_PORT}/${BENCH_DB_NAME}}"
: "${BENCH_API_PORT:=8788}"
: "${BENCH_PREVIEW_PORT:=4173}"
: "${BENCH_HOST:=http://localhost:${BENCH_API_PORT}}"
: "${BENCH_DURATION:=15}"
: "${BENCH_CONNECTIONS:=50}"

PSQL=$(command -v psql || true)
if [[ -z "$PSQL" ]]; then
  for c in /opt/homebrew/opt/postgresql@16/bin/psql /usr/local/opt/postgresql@16/bin/psql /usr/lib/postgresql/16/bin/psql; do
    [[ -x "$c" ]] && PSQL="$c" && break
  done
fi
CREATEDB=$(command -v createdb || true)
if [[ -z "$CREATEDB" && -n "$PSQL" ]]; then
  CREATEDB="$(dirname "$PSQL")/createdb"
fi

require_psql() {
  if [[ -z "$PSQL" || ! -x "$PSQL" ]]; then
    echo "error: psql not found. Install Postgres 14+ (macOS: 'brew install postgresql@16'; Linux: apt/dnf install postgresql)." >&2
    exit 1
  fi
}

# Stub R2 + LLM creds — server boots, but R2/LLM endpoints would fail if hit.
# The bench only exercises endpoints that don't touch them.
export DATABASE_URL="$BENCH_DATABASE_URL"
export R2_ENDPOINT="${R2_ENDPOINT:-http://stub}"
export R2_BUCKET="${R2_BUCKET:-stub}"
export R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-stub}"
export R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-stub}"
export JWT_SECRET="${JWT_SECRET:-bench-jwt-secret}"
export TWELVELABS_API_KEY="${TWELVELABS_API_KEY:-stub}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-stub}"
export PORT="$BENCH_API_PORT"
export NODE_ENV="${NODE_ENV:-production}"

BENCH_PID_FILE="$BENCH_DIR/.server.pid"
BENCH_PREVIEW_PID_FILE="$BENCH_DIR/.preview.pid"
BENCH_LOG="$BENCH_DIR/.server.log"
BENCH_PREVIEW_LOG="$BENCH_DIR/.preview.log"
BENCH_TOKEN_FILE="$BENCH_DIR/.token"
BENCH_USER_FILE="$BENCH_DIR/.user_id"
