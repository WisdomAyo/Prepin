# ────────────────────────────────────────────────────────────────
# Local development startup script for Windows.
#
# Usage:
#   .\scripts\dev.ps1          # Start everything
#   .\scripts\dev.ps1 backend  # Start only the backend
#   .\scripts\dev.ps1 frontend # Start only the frontend
#   .\scripts\dev.ps1 infra    # Start only Docker services
# ────────────────────────────────────────────────────────────────

param(
    [string]$Component = "all"
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Start-Infra {
    Write-Host "▸ Starting infrastructure (Postgres, Redis, Ollama)..." -ForegroundColor Cyan
    docker compose -f "$Root\docker-compose.yml" up -d
    Start-Sleep -Seconds 3
    Write-Host "  ✓ Infrastructure ready." -ForegroundColor Green
}

function Start-Backend {
    Write-Host "▸ Starting backend (FastAPI)..." -ForegroundColor Cyan
    Push-Location "$Root\packages\backend"

    # Create virtualenv if it doesn't exist
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
        .\.venv\Scripts\pip install -e ".[dev,local]"
    }

    # Copy .env if needed
    if (-not (Test-Path "$Root\.env")) {
        Copy-Item "$Root\.env.example" "$Root\.env"
        Write-Host "  Created .env from .env.example"
    }

    Start-Process -NoNewWindow -FilePath ".\.venv\Scripts\uvicorn" -ArgumentList "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"
    Write-Host "  ✓ Backend running at http://localhost:8000" -ForegroundColor Green
    Pop-Location
}

function Start-Frontend {
    Write-Host "▸ Starting frontend (Vite)..." -ForegroundColor Cyan
    Push-Location $Root
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev:web"
    Write-Host "  ✓ Frontend running at http://localhost:5173" -ForegroundColor Green
    Pop-Location
}

switch ($Component) {
    "infra"    { Start-Infra }
    "backend"  { Start-Backend }
    "frontend" { Start-Frontend }
    "all" {
        Start-Infra
        Start-Backend
        Start-Frontend
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Yellow
        Write-Host "  Interview Copilot — local dev environment"
        Write-Host "  Frontend:  http://localhost:5173"
        Write-Host "  Backend:   http://localhost:8000"
        Write-Host "  API docs:  http://localhost:8000/docs"
        Write-Host "  Health:    http://localhost:8000/health"
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Yellow
    }
    default {
        Write-Host "Usage: .\scripts\dev.ps1 [all|infra|backend|frontend]"
    }
}
