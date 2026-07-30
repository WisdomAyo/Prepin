"""
Session management API.

CRUD for copilot sessions. The control plane creates a session record
in Postgres and stores ephemeral context in Redis so the WebSocket
gateway can pick it up immediately.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.auth.middleware import AuthUser, get_current_user, get_optional_user
import app.db.engine as db_engine
from app.db.models import Document, Session
from app.realtime.gateway import context_mgr
from app import redis_store

router = APIRouter()


class CreateSessionRequest(BaseModel):
    mode: str  # "live" or "prep"
    resume_id: str | None = None
    jd_id: str | None = None
    additional_context: str | None = None
    stealth_mode: bool = False


class SessionResponse(BaseModel):
    id: str
    mode: str
    status: str
    resume_id: str | None
    jd_id: str | None
    stealth_mode: bool = False
    created_at: str


@router.post("", response_model=SessionResponse)
async def create_session(
    req: CreateSessionRequest,
    user: AuthUser | None = Depends(get_optional_user),
) -> SessionResponse:
    """Create a new copilot session and pre-load context."""
    import logging, traceback
    _log = logging.getLogger(__name__)

    if req.mode not in ("live", "prep"):
        raise HTTPException(400, "mode must be 'live' or 'prep'")
    if req.stealth_mode and req.mode != "live":
        raise HTTPException(400, "stealth_mode is only supported for live sessions")

    user_id = user.id if user else uuid.UUID("00000000-0000-0000-0000-000000000000")
    session_id = str(uuid.uuid4())

    resume_text = ""
    jd_text = ""

    try:
        assert db_engine.async_session_factory is not None
        async with db_engine.async_session_factory() as db:
            if req.resume_id:
                result = await db.execute(
                    select(Document).where(Document.id == uuid.UUID(req.resume_id))
                )
                doc = result.scalar_one_or_none()
                if doc:
                    resume_text = doc.raw_text

            if req.jd_id:
                result = await db.execute(
                    select(Document).where(Document.id == uuid.UUID(req.jd_id))
                )
                doc = result.scalar_one_or_none()
                if doc:
                    jd_text = doc.raw_text

            session = Session(
                id=uuid.UUID(session_id),
                user_id=user_id,
                mode=req.mode,
                status="active",
                resume_id=uuid.UUID(req.resume_id) if req.resume_id else None,
                jd_id=uuid.UUID(req.jd_id) if req.jd_id else None,
            )
            db.add(session)
            await db.commit()
    except Exception as e:
        _log.error("Session creation failed:\n%s", traceback.format_exc())
        raise HTTPException(500, detail=f"Session creation failed: {e}")

    # Store ephemeral context in Redis so the WebSocket gateway can load it
    await redis_store.store_session_context(session_id, {
        "resume_text": resume_text,
        "jd_text": jd_text,
        "additional_context": req.additional_context or "",
        "stealth_mode": req.stealth_mode,
    })

    # Store session metadata (document IDs) in Redis for RAG retrieval
    await redis_store.store_session_meta(session_id, {
        "resume_id": req.resume_id,
        "jd_id": req.jd_id,
        "user_id": str(user_id),
        "mode": req.mode,
        "stealth_mode": req.stealth_mode,
    })

    # Also pre-load into the in-process context manager for immediate use
    context_mgr.create_session(
        session_id=session_id,
        resume_text=resume_text,
        jd_text=jd_text,
        additional_context=req.additional_context or "",
        stealth_mode=req.stealth_mode,
    )

    return SessionResponse(
        id=session_id,
        mode=req.mode,
        status="active",
        resume_id=req.resume_id,
        jd_id=req.jd_id,
        stealth_mode=req.stealth_mode,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/{session_id}/end")
async def end_session(session_id: str) -> dict[str, str]:
    """End a session and clean up ephemeral state."""
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        result = await db.execute(
            select(Session).where(Session.id == uuid.UUID(session_id))
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "Session not found")

        session.status = "ended"
        session.ended_at = datetime.now(timezone.utc)
        await db.commit()

    # Clean up all ephemeral data
    context_mgr.remove_session(session_id)
    await redis_store.purge_session(session_id)

    return {"status": "ended"}


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    user: AuthUser | None = Depends(get_optional_user),
) -> list[SessionResponse]:
    """List sessions for a user."""
    user_id = user.id if user else uuid.UUID("00000000-0000-0000-0000-000000000000")

    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        result = await db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.created_at.desc())
        )
        sessions = result.scalars().all()

    return [
        SessionResponse(
            id=str(s.id),
            mode=s.mode,
            status=s.status,
            resume_id=str(s.resume_id) if s.resume_id else None,
            jd_id=str(s.jd_id) if s.jd_id else None,
            stealth_mode=False,
            created_at=s.created_at.isoformat() if s.created_at else "",
        )
        for s in sessions
    ]
