"""
RAG Retriever.

Takes a detected question, embeds it, searches the vector store for
relevant resume/JD chunks, and returns them for the LLM orchestrator.

Architecture decisions:
  - Retrieval is scoped to the session's linked documents (resume + JD).
  - Returns top-K chunks sorted by similarity.
  - Applies a minimum similarity threshold to avoid injecting noise.
  - Chunks are returned as plain text strings — the context manager
    handles delimiting them as untrusted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import app.providers as providers

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 5
MIN_SIMILARITY = 0.3


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    document_id: str
    text: str
    similarity: float


async def retrieve_for_question(
    question_text: str,
    document_ids: list[str],
    top_k: int = DEFAULT_TOP_K,
    min_similarity: float = MIN_SIMILARITY,
) -> list[RetrievedChunk]:
    """
    Embed the question and retrieve the most relevant chunks from
    the user's documents.
    """
    if not document_ids:
        logger.debug("No documents linked — skipping retrieval.")
        return []

    # Embed the question
    query_embedding = await providers.embedder.embed([question_text])
    query_vec = query_embedding[0]

    # Search
    results = await providers.vector_store.search(
        query_vec,
        top_k=top_k,
        filter_document_ids=document_ids,
    )

    # Filter by similarity threshold
    chunks = [
        RetrievedChunk(
            document_id=r.document_id,
            text=r.text,
            similarity=r.similarity,
        )
        for r in results
        if r.similarity >= min_similarity
    ]

    logger.info(
        "Retrieved %d chunks (from %d results) for question: %s",
        len(chunks),
        len(results),
        question_text[:80],
    )
    return chunks
