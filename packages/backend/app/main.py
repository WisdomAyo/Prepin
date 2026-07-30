"""
Application entry-point.

Two planes:
  - Control plane: REST endpoints for auth, document upload, dashboard, history,
    scoring, prep, drill, and privacy.
  - Real-time plane: WebSocket session gateway → STT → detect → retrieve → answer.

Both are mounted on the same FastAPI instance but are logically separate.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.engine import init_db, dispose_db
from app.observability import init_observability
from app.providers import init_providers, shutdown_providers
from app.redis_store import init_redis, close_redis
from app.realtime.gateway import init_gateway

# ── Route imports ─────────────────────────────────────────────
from app.api.auth_routes import router as auth_router
from app.api.documents import router as documents_router
from app.api.sessions import router as sessions_router
from app.api.scoring import router as scoring_router
from app.api.prep import router as prep_router
from app.api.drill import router as drill_router
from app.api.privacy import router as privacy_router
from app.api.screenshot import router as screenshot_router
from app.realtime.gateway import router as ws_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hooks."""
    logging.basicConfig(level=settings.log_level)
    logger.info("Starting Interview Copilot — profile=%s", settings.provider_profile.value)

    # Infrastructure
    await init_db()
    await init_redis()

    # AI providers
    await init_providers()

    # Wire the gateway's rolling summarizer to the cheap LLM
    init_gateway()

    # Observability (OTel + Sentry) — must be after app creation
    init_observability(app)

    logger.info("All systems initialized.")
    yield

    # Shutdown
    await shutdown_providers()
    await close_redis()
    await dispose_db()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="Interview Copilot API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Control plane ─────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(sessions_router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(scoring_router, prefix="/api/v1/scoring", tags=["scoring"])
app.include_router(prep_router, prefix="/api/v1/prep", tags=["prep"])
app.include_router(drill_router, prefix="/api/v1/drill", tags=["drill"])
app.include_router(privacy_router, prefix="/api/v1/privacy", tags=["privacy"])
app.include_router(screenshot_router, prefix="/api/v1/screenshot", tags=["screenshot"])

# ── Real-time plane ──────────────────────────────────────────
app.include_router(ws_router, prefix="/ws", tags=["realtime"])


@app.exception_handler(Exception)
async def _global_exception_handler(request, exc):
    import traceback
    logger.error("Unhandled exception on %s %s:\n%s", request.method, request.url.path, traceback.format_exc())
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "profile": settings.provider_profile.value}
