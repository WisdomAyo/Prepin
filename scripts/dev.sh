#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────
# Local development startup script.
#
# Usage:
#   ./scripts/dev.sh          # Start everything
#   ./scripts/dev.sh backend  # Start only the backend
#   ./scripts/dev.sh frontend # Start only the frontend
#   ./scripts/dev.sh infra    # Start only Docker services
# ────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPONENT="${1:-all}"

start_infra() {
  echo "▸ Starting infrastructure (Postgres, Redis, Ollama)..."
  docker compose -f "$ROOT/docker-compose.yml" up -d
  echo "  Waiting for services..."
  sleep 3
  echo "  ✓ Infrastructure ready."
}

start_backend() {
  echo "▸ Starting backend (FastAPI)..."
  cd "$ROOT/packages/backend"

  # Create virtualenv if it doesn't exist
  if [ ! -d ".venv" ]; then
    python -m venv .venv
    .venv/bin/pip install -e ".[dev,local]"
  fi

  # Copy .env if needed
  if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "  Created .env from .env.example"
  fi

  # Pull Ollama model if not present
  if command -v ollama &>/dev/null; then
    echo "  Pulling Ollama model (if not cached)..."
    ollama pull qwen2.5:7b 2>/dev/null || true
  fi

  .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  echo "  ✓ Backend running at http://localhost:8000"
}

start_frontend() {
  echo "▸ Starting frontend (Vite)..."
  cd "$ROOT"
  npm run dev:web &
  echo "  ✓ Frontend running at http://localhost:5173"
}

case "$COMPONENT" in
  infra)
    start_infra
    ;;
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  all)
    start_infra
    start_backend
    start_frontend
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  Interview Copilot — local dev environment"
    echo "  Frontend:  http://localhost:5173"
    echo "  Backend:   http://localhost:8000"
    echo "  API docs:  http://localhost:8000/docs"
    echo "  Health:    http://localhost:8000/health"
    echo "═══════════════════════════════════════════════"
    wait
    ;;
  *)
    echo "Usage: $0 [all|infra|backend|frontend]"
    exit 1
    ;;
esac
