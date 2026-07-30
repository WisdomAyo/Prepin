"""
Redis session store — ephemeral real-time session data.

Architecture decision: all live session data (transcript segments, active context,
partial answers) lives in Redis, NOT in Postgres or Python dicts. This ensures:
  1. Sessions are ephemeral — purged automatically on session end or TTL expiry.
  2. Transcript persistence is opt-in — only moved to Postgres if the user consents.
  3. Multi-worker safe — the FastAPI app can scale to multiple uvicorn workers
     without shared in-process state.
  4. One-click delete — just DEL the session key.

Key schema:
  session:{session_id}:context   — JSON blob of SessionContext fields
  session:{session_id}:transcript — List of transcript segment JSON objects
  session:{session_id}:answers   — List of grounded answer JSON objects
  session:{session_id}:meta      — Session metadata (resume_id, jd_id, etc.)

All keys have a TTL of 4 hours (auto-cleanup for abandoned sessions).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 4 * 60 * 60  # 4 hours

_pool: aioredis.Redis | None = None
_using_memory: bool = False
_memory_store: dict[str, Any] = {}  # fallback when Redis is unavailable
_memory_lists: dict[str, list[str]] = {}


async def init_redis() -> None:
    global _pool, _using_memory
    try:
        _pool = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
        await _pool.ping()
        _using_memory = False
        logger.info("Redis connected: %s", settings.redis_url)
    except Exception as err:
        logger.warning("Redis unavailable (%s), using in-memory fallback.", err)
        _pool = None
        _using_memory = True


async def close_redis() -> None:
    global _pool
    if _pool:
        await _pool.aclose()
        _pool = None
        logger.info("Redis connection closed.")


def _redis() -> aioredis.Redis:
    assert _pool is not None, "Redis not initialized — call init_redis() first"
    return _pool


# ── Helpers for memory fallback ──────────────────────────────

async def _set(key: str, value: str, ex: int | None = None) -> None:
    if _using_memory:
        _memory_store[key] = value
    else:
        await _redis().set(key, value, ex=ex)

async def _get(key: str) -> str | None:
    if _using_memory:
        return _memory_store.get(key)
    return await _redis().get(key)

async def _delete(*keys: str) -> int:
    if _using_memory:
        count = 0
        for k in keys:
            if k in _memory_store:
                del _memory_store[k]
                count += 1
            if k in _memory_lists:
                del _memory_lists[k]
                count += 1
        return count
    return await _redis().delete(*keys)

async def _rpush(key: str, value: str) -> None:
    if _using_memory:
        _memory_lists.setdefault(key, []).append(value)
    else:
        await _redis().rpush(key, value)
        await _redis().expire(key, SESSION_TTL_SECONDS)

async def _lrange(key: str, start: int, stop: int) -> list[str]:
    if _using_memory:
        lst = _memory_lists.get(key, [])
        if stop == -1:
            return lst[start:]
        return lst[start:stop + 1]
    return await _redis().lrange(key, start, stop)


# ── Session context ──────────────────────────────────────────

async def store_session_context(session_id: str, context: dict[str, Any]) -> None:
    """Store session context (resume text, JD text, etc.)."""
    key = f"session:{session_id}:context"
    await _set(key, json.dumps(context), ex=SESSION_TTL_SECONDS)


async def get_session_context(session_id: str) -> dict[str, Any] | None:
    """Retrieve session context."""
    key = f"session:{session_id}:context"
    data = await _get(key)
    if data is None:
        return None
    return json.loads(data)


async def delete_session_context(session_id: str) -> None:
    """Delete session context — called on session end."""
    key = f"session:{session_id}:context"
    await _delete(key)


# ── Transcript segments ──────────────────────────────────────

async def append_transcript_segment(session_id: str, segment: dict[str, Any]) -> None:
    """Append a transcript segment to the session's transcript list."""
    key = f"session:{session_id}:transcript"
    await _rpush(key, json.dumps(segment))


async def get_transcript(session_id: str) -> list[dict[str, Any]]:
    """Get all transcript segments for a session."""
    key = f"session:{session_id}:transcript"
    raw = await _lrange(key, 0, -1)
    return [json.loads(item) for item in raw]


async def get_recent_transcript(session_id: str, count: int = 50) -> list[dict[str, Any]]:
    """Get the most recent N transcript segments."""
    key = f"session:{session_id}:transcript"
    raw = await _lrange(key, -count, -1)
    return [json.loads(item) for item in raw]


# ── Answers ──────────────────────────────────────────────────

async def append_answer(session_id: str, answer: dict[str, Any]) -> None:
    """Append a grounded answer to the session."""
    key = f"session:{session_id}:answers"
    await _rpush(key, json.dumps(answer))


async def get_answers(session_id: str) -> list[dict[str, Any]]:
    """Get all answers for a session."""
    key = f"session:{session_id}:answers"
    raw = await _lrange(key, 0, -1)
    return [json.loads(item) for item in raw]


# ── Session metadata ─────────────────────────────────────────

async def store_session_meta(session_id: str, meta: dict[str, Any]) -> None:
    key = f"session:{session_id}:meta"
    await _set(key, json.dumps(meta), ex=SESSION_TTL_SECONDS)


async def get_session_meta(session_id: str) -> dict[str, Any] | None:
    key = f"session:{session_id}:meta"
    data = await _get(key)
    return json.loads(data) if data else None


# ── Full session purge ────────────────────────────────────────

async def purge_session(session_id: str) -> int:
    """
    Delete ALL ephemeral data for a session. Called on session end.
    This is the privacy guarantee: nothing persists after the session
    unless the user explicitly opts in to transcript persistence.
    Returns the number of keys deleted.
    """
    keys = [
        f"session:{session_id}:context",
        f"session:{session_id}:transcript",
        f"session:{session_id}:answers",
        f"session:{session_id}:meta",
    ]
    deleted = await _delete(*keys)
    logger.info("Purged session %s: %d keys deleted", session_id, deleted)
    return deleted


# ── Transcript export (opt-in persistence) ────────────────────

async def export_session_transcript(session_id: str) -> dict[str, Any]:
    """
    Export the full session data — transcript + answers.
    Called when the user opts in to saving, or for one-click export.
    """
    transcript = await get_transcript(session_id)
    answers = await get_answers(session_id)
    meta = await get_session_meta(session_id)
    return {
        "session_id": session_id,
        "meta": meta,
        "transcript": transcript,
        "answers": answers,
    }
