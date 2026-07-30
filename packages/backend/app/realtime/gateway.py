"""
WebSocket Session Gateway.

Real-time plane entry point. Each WebSocket = one copilot session.
Supports two audio modes:
  1. speech_segment — VAD-segmented PCM from system audio capture (primary)
  2. transcript_text — browser-originated text (fallback)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import TYPE_CHECKING

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime.context_manager import ContextManager, SessionContext
from app.realtime.question_detector import QuestionDetector
from app.realtime.orchestrator import generate_answer
import app.providers as providers
from app.providers.stt import STTSegment
from app import redis_store
from app.api.screenshot import analyze_screenshot_image

logger = logging.getLogger(__name__)
router = APIRouter()

context_mgr = ContextManager()
_SUMMARIZE_EVERY_N_SEGMENTS = 20


def init_gateway() -> None:
    context_mgr.set_summarizer(providers.llm_cheap)


@router.websocket("/session/{session_id}")
async def session_websocket(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    logger.info("WebSocket connected: session=%s", session_id)

    ctx = context_mgr.get_session(session_id)
    if ctx is None:
        redis_ctx = await redis_store.get_session_context(session_id)
        if redis_ctx:
            ctx = context_mgr.create_session(
                session_id,
                resume_text=redis_ctx.get("resume_text", ""),
                jd_text=redis_ctx.get("jd_text", ""),
                additional_context=redis_ctx.get("additional_context", ""),
                stealth_mode=bool(redis_ctx.get("stealth_mode", False)),
            )
        else:
            ctx = context_mgr.create_session(session_id)

    detector = QuestionDetector(
        llm_provider=providers.llm_cheap,
        llm_fallbacks=[fb for fb, _ in providers.llm_fallbacks],
    )
    document_ids = await _get_document_ids(session_id)
    stealth_mode = await _get_stealth_mode(session_id, ctx)
    segment_count = 0

    await ws.send_json({
        "type": "session_settings",
        "payload": {
            "stealthMode": stealth_mode,
            "transcriptVisible": not stealth_mode,
            "answerPersistence": not stealth_mode,
        },
    })

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type in ("pause", "end"):
                break

            if msg_type == "speech_segment":
                asyncio.create_task(
                    _handle_speech_segment(
                        ws, msg, ctx, detector, document_ids, session_id, stealth_mode
                    )
                )
                continue

            if msg_type == "transcript_text":
                text = msg.get("text", "").strip()
                if not text:
                    continue
                is_final = msg.get("isFinal", True)
                ts = msg.get("timestampMs", 0)
                segment = STTSegment(
                    text=text,
                    start_ms=ts,
                    end_ms=ts,
                    is_final=is_final,
                    confidence=0.9,
                )

                segment_count += 1
                await _process_segment(
                    ws, segment, ctx, detector, document_ids,
                    session_id, segment_count, from_browser=True, stealth_mode=stealth_mode,
                )
                if segment_count % _SUMMARIZE_EVERY_N_SEGMENTS == 0:
                    asyncio.create_task(ctx.summarize_overflow())
                continue

            if msg_type == "screenshot_analyze":
                asyncio.create_task(
                    _handle_screenshot(ws, msg, session_id)
                )
                continue

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: session=%s", session_id)
    except Exception:
        logger.exception("Error in session %s", session_id)
        try:
            await ws.send_json({
                "type": "error",
                "payload": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred.",
                },
            })
        except Exception:
            pass
    finally:
        detector.reset()
        await redis_store.purge_session(session_id)
        context_mgr.remove_session(session_id)
        logger.info("Session ended and purged: %s", session_id)


async def _handle_speech_segment(
    ws: WebSocket,
    msg: dict,
    ctx: SessionContext,
    detector: QuestionDetector,
    document_ids: list[str],
    session_id: str,
    stealth_mode: bool,
) -> None:
    """Transcribe a VAD-segmented audio chunk and process it."""
    t0 = time.monotonic()

    try:
        pcm_bytes = base64.b64decode(msg["data"])
        n_samples = len(pcm_bytes) // 2

        logger.info("Transcribing %d samples via %s", n_samples, type(providers.stt).__name__)
        text = await _transcribe_audio(pcm_bytes)
        if not text:
            logger.warning("STT returned empty text for %d samples", n_samples)
            await ws.send_json({"type": "error", "payload": {"code": "STT_EMPTY", "message": f"STT returned empty for {n_samples} samples"}})
            return

        transcribe_ms = int((time.monotonic() - t0) * 1000)
        if stealth_mode:
            logger.info("STT: %dms -> [redacted: stealth mode]", transcribe_ms)
        else:
            logger.info("STT: %dms -> %s", transcribe_ms, text[:80])

        ts = msg.get("timestampMs", int(time.time() * 1000))
        segment = STTSegment(
            text=text,
            start_ms=ts,
            end_ms=ts + transcribe_ms,
            is_final=True,
            confidence=0.95,
        )

        if not stealth_mode:
            await ws.send_json({
                "type": "transcript",
                "payload": {
                    "sessionId": session_id,
                    "speaker": "unknown",
                    "text": text,
                    "startMs": ts,
                    "isFinal": True,
                },
            })

        await _process_segment(
            ws, segment, ctx, detector, document_ids, session_id, 0,
            from_browser=False, stealth_mode=stealth_mode,
        )

    except Exception as e:
        logger.exception("Speech segment processing failed")
        try:
            await ws.send_json({"type": "error", "payload": {"code": "STT_FAILED", "message": str(e)}})
        except Exception:
            pass


async def _transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe int16 PCM bytes via the active STT provider."""
    stt = providers.stt

    if hasattr(stt, "transcribe_file"):
        segments = await stt.transcribe_file(audio_bytes, sample_rate=16000)
        return " ".join(s.text for s in segments).strip()

    async def _single_chunk():
        yield audio_bytes

    parts = []
    async for seg in stt.transcribe_stream(_single_chunk()):
        parts.append(seg.text)
    return " ".join(parts).strip()


async def _process_segment(
    ws: WebSocket,
    segment: STTSegment,
    ctx: SessionContext,
    detector: QuestionDetector,
    document_ids: list[str],
    session_id: str,
    segment_count: int,
    from_browser: bool,
    stealth_mode: bool,
) -> None:
    """Common pipeline: store, detect questions, generate answers."""
    if not stealth_mode:
        await redis_store.append_transcript_segment(session_id, {
            "text": segment.text,
            "start_ms": segment.start_ms,
            "end_ms": segment.end_ms,
            "is_final": segment.is_final,
            "confidence": segment.confidence,
        })
        ctx.add_transcript_segment(segment.text)

    detected = await detector.feed_async(segment.text, segment.start_ms)
    if detected and detected.confidence >= 0.7:
        await ws.send_json({
            "type": "question_detected",
            "payload": {
                "text": detected.text,
                "confidence": detected.confidence,
                "timestampMs": detected.timestamp_ms,
            },
        })
        asyncio.create_task(
            _handle_question(ws, detected.text, ctx, document_ids, session_id, stealth_mode)
        )


async def _handle_question(
    ws: WebSocket,
    question_text: str,
    ctx: SessionContext,
    document_ids: list[str],
    session_id: str,
    stealth_mode: bool,
) -> None:
    try:
        result = await generate_answer(question_text, ctx, document_ids)

        answer_payload = {
            "triggerText": question_text,
            "headline": result.response.headline,
            "bullets": list(result.response.bullets),
            "spokenVersion": result.response.spoken_version,
            "groundingSources": [
                {
                    "documentId": c.document_id,
                    "chunkText": c.text[:200],
                    "similarity": c.similarity,
                }
                for c in result.chunks_used
            ],
            "hasAssumptions": result.response.has_assumptions,
            "provider": result.provider_used,
            "latencyMs": result.latency_ms,
        }

        if not stealth_mode:
            await redis_store.append_answer(session_id, answer_payload)
        await ws.send_json({"type": "answer", "payload": answer_payload})

    except Exception:
        logger.exception("Failed to generate answer for: %s", question_text[:80])


async def _get_document_ids(session_id: str) -> list[str]:
    meta = await redis_store.get_session_meta(session_id)
    if not meta:
        return []
    ids = []
    if meta.get("resume_id"):
        ids.append(meta["resume_id"])
    if meta.get("jd_id"):
        ids.append(meta["jd_id"])
    return ids


async def _get_stealth_mode(session_id: str, ctx: SessionContext) -> bool:
    meta = await redis_store.get_session_meta(session_id)
    if meta and "stealth_mode" in meta:
        return bool(meta["stealth_mode"])
    return ctx.stealth_mode


async def _handle_screenshot(
    ws: WebSocket,
    msg: dict,
    session_id: str,
) -> None:
    """Analyze a screenshot sent over WebSocket via Gemini multimodal API."""
    try:
        image_b64 = msg.get("data", "")
        if not image_b64:
            await ws.send_json({
                "type": "error",
                "payload": {"code": "SCREENSHOT_EMPTY", "message": "No image data provided"},
            })
            return

        question = msg.get("question")
        context = msg.get("context")

        # Detect MIME type from base64 header or default to PNG
        mime_type = "image/png"
        if image_b64.startswith("/9j/"):
            mime_type = "image/jpeg"
        elif image_b64.startswith("UklGR"):
            mime_type = "image/webp"

        logger.info(
            "WebSocket screenshot analysis: session=%s question=%s",
            session_id,
            question[:80] if question else None,
        )

        result = await analyze_screenshot_image(image_b64, mime_type, question, context)

        await ws.send_json({
            "type": "answer",
            "payload": {
                "triggerText": question or "[screenshot analysis]",
                "headline": result.headline,
                "bullets": result.bullets,
                "spokenVersion": result.spoken_version,
                "groundingSources": [],
                "hasAssumptions": result.has_assumptions,
                "provider": "gemini-screenshot",
                "latencyMs": 0,
            },
        })

    except Exception as e:
        logger.exception("Screenshot analysis failed: session=%s", session_id)
        try:
            await ws.send_json({
                "type": "error",
                "payload": {"code": "SCREENSHOT_FAILED", "message": str(e)},
            })
        except Exception:
            pass
