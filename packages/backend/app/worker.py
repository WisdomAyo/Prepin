"""
arq background worker — async task processing.

Offloads heavy work from request handlers:
  1. Document ingestion (text extraction → chunking → embedding → pgvector).
  2. Post-session scoring (LLM calls for rubric evaluation).
  3. Rolling transcript summarization.

Architecture decision: arq was chosen over Celery because it's native async,
has zero-config Redis backend, and integrates cleanly with the rest of the
async stack. CPU-heavy tasks (embedding, Whisper) still run in executors
within the worker — they just don't block the API server's event loop.

Usage:
  arq app.worker.WorkerSettings
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.config import settings

logger = logging.getLogger(__name__)


async def ingest_document(
    ctx: dict[str, Any],
    document_id: str,
    user_id: str,
    raw_text: str,
    doc_type: str,
    filename: str,
    label: str | None,
) -> dict[str, Any]:
    """
    Background task: chunk text, embed, and store in pgvector.

    This runs in the arq worker process, not the API server. The API
    endpoint returns immediately with the document ID; the client
    polls or gets a WebSocket notification when ingestion completes.
    """
    from app.db.engine import init_db, async_session_factory
    from app.db.models import Document
    from app.providers.local.local_embedder import LocalEmbedder
    from app.providers.local.pg_vector_store import PgVectorStore
    from app.providers.vector_store import VectorChunk

    logger.info("Ingesting document %s: %s", document_id, filename)

    # Initialize providers if not already done (worker process)
    embedder = ctx.get("embedder")
    if not embedder:
        embedder = LocalEmbedder(model_name=settings.local_embed_model)
        await embedder.initialize()
        ctx["embedder"] = embedder

    vector_store = ctx.get("vector_store")
    if not vector_store:
        vector_store = PgVectorStore()
        await vector_store.initialize()
        ctx["vector_store"] = vector_store

    if not async_session_factory:
        await init_db()

    # Chunk
    chunks = _chunk_text(raw_text)

    # Embed
    embeddings = await embedder.embed(chunks)

    # Store in Postgres
    assert async_session_factory is not None
    async with async_session_factory() as session:
        doc = Document(
            id=uuid.UUID(document_id),
            user_id=uuid.UUID(user_id),
            doc_type=doc_type,
            filename=filename,
            label=label,
            raw_text=raw_text,
            chunk_count=len(chunks),
        )
        await session.merge(doc)
        await session.commit()

    # Store vectors
    vector_chunks = [
        VectorChunk(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text=chunk_text,
            embedding=embeddings[i],
            metadata={"chunk_index": str(i), "doc_type": doc_type},
        )
        for i, chunk_text in enumerate(chunks)
    ]
    await vector_store.upsert(vector_chunks)

    logger.info("Document %s ingested: %d chunks", document_id, len(chunks))
    return {"document_id": document_id, "chunk_count": len(chunks)}


async def score_session_answers(
    ctx: dict[str, Any],
    session_id: str,
    answers: list[dict[str, str]],
    resume_context: str,
    jd_context: str,
) -> dict[str, Any]:
    """
    Background task: score all answers from a prep session.

    Calls the cheap LLM for each answer, aggregates scores, and
    persists the scorecard to Postgres.
    """
    from app.db.engine import init_db, async_session_factory
    from app.db.models import SessionScore
    from app.providers.local.ollama_llm import OllamaLLM
    from app.providers.llm import GroundedPrompt

    logger.info("Scoring session %s: %d answers", session_id, len(answers))

    llm = ctx.get("llm_cheap")
    if not llm:
        llm = OllamaLLM(model=settings.ollama_model)
        await llm.initialize()
        ctx["llm_cheap"] = llm

    if not async_session_factory:
        await init_db()

    import re

    SCORING_PROMPT = """Score this interview answer on 5 dimensions (1-5):
structure, specificity, jd_relevance, conciseness, confidence.
Respond as JSON: {"dimensions": [{"dimension": "...", "score": N, "feedback": "..."}], "overall_score": N.N, "improvement_tip": "..."}"""

    scored = []
    all_dims: dict[str, list[int]] = {
        d: [] for d in ["structure", "specificity", "jd_relevance", "conciseness", "confidence"]
    }

    for answer in answers:
        prompt = GroundedPrompt(
            system_preamble=SCORING_PROMPT,
            retrieved_context=[resume_context, jd_context] if resume_context else [],
            user_query=f"Question: {answer['question']}\n\nAnswer: {answer['user_answer']}",
        )
        try:
            response = await llm.generate(prompt)
            cleaned = re.sub(r"```json?\s*", "", response.raw_text)
            cleaned = re.sub(r"```\s*$", "", cleaned).strip()
            data = json.loads(cleaned)

            for d in data.get("dimensions", []):
                dim = d["dimension"]
                score = max(1, min(5, int(d["score"])))
                if dim in all_dims:
                    all_dims[dim].append(score)

            scored.append({
                "question": answer["question"],
                "dimensions": data.get("dimensions", []),
                "overall_score": data.get("overall_score", 3.0),
                "improvement_tip": data.get("improvement_tip", ""),
            })
        except Exception:
            logger.exception("Failed to score answer")
            scored.append({
                "question": answer["question"],
                "dimensions": [],
                "overall_score": 0,
                "improvement_tip": "Scoring failed",
            })

    avg = sum(a["overall_score"] for a in scored) / len(scored) if scored else 0
    dim_avgs = {d: sum(s) / len(s) if s else 0 for d, s in all_dims.items()}
    weakest = min(dim_avgs, key=lambda k: dim_avgs[k]) if dim_avgs else "structure"

    # Persist
    assert async_session_factory is not None
    async with async_session_factory() as db:
        record = SessionScore(
            id=uuid.uuid4(),
            session_id=uuid.UUID(session_id),
            average_score=avg,
            dimension_averages=dim_avgs,
            weakest_dimension=weakest,
            drill_recommendations=[f"Focus on {weakest} questions"],
            answers_detail=scored,
        )
        db.add(record)
        await db.commit()

    logger.info("Session %s scored: avg=%.2f, weakest=%s", session_id, avg, weakest)
    return {"session_id": session_id, "average_score": avg, "weakest_dimension": weakest}


async def summarize_transcript(
    ctx: dict[str, Any],
    session_id: str,
    segments: list[str],
) -> str:
    """Background task: LLM-based rolling summarization of transcript overflow."""
    from app.providers.local.ollama_llm import OllamaLLM
    from app.providers.llm import GroundedPrompt

    llm = ctx.get("llm_cheap")
    if not llm:
        llm = OllamaLLM(model=settings.ollama_model)
        await llm.initialize()
        ctx["llm_cheap"] = llm

    text = " ".join(segments)
    prompt = GroundedPrompt(
        system_preamble=(
            "Summarize this conversation transcript in 2-3 sentences. "
            "Focus on key topics discussed and any important details mentioned. "
            "Do not invent information. Respond with ONLY the summary text."
        ),
        user_query=text,
    )

    try:
        response = await llm.generate(prompt)
        return response.raw_text.strip()
    except Exception:
        logger.exception("Summarization failed, falling back to truncation")
        return text[-2000:]


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


async def startup(ctx: dict[str, Any]) -> None:
    """arq worker startup — initialize DB connection."""
    from app.db.engine import init_db
    await init_db()
    logger.info("arq worker started")


async def shutdown(ctx: dict[str, Any]) -> None:
    """arq worker shutdown — cleanup."""
    from app.db.engine import dispose_db
    await dispose_db()

    for key in ["embedder", "vector_store", "llm_cheap"]:
        provider = ctx.get(key)
        if provider:
            await provider.shutdown()

    logger.info("arq worker shut down")


class WorkerSettings:
    """arq worker configuration."""
    functions = [ingest_document, score_session_answers, summarize_transcript]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 5
    job_timeout = 300  # 5 minutes
