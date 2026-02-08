#!/usr/bin/env bash
# Run Alembic migrations for Path Boarding backend.
# Requires: /opt/boarding/backend.env and RDS reachable from this host.
# Usage: sudo -E bash deploy/run-migrations.sh (from repo root)
#   or: cd /opt/boarding/repo && sudo -E bash deploy/run-migrations.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/opt/boarding/backend.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from backend/.env.example and set DATABASE_URL."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

cd "$REPO_ROOT/backend"
VENV="${VENV:-/opt/boarding/venv}"
if [[ -x "$VENV/bin/alembic" ]]; then
  "$VENV/bin/alembic" upgrade head
else
  # Fallback if venv not at default path
  python3 -m alembic upgrade head
fi

echo "Migrations complete."
