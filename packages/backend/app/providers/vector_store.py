"""
VectorStore — vector similarity search interface.

Abstracts pgvector (or any future vector DB). The RAG retriever
depends only on this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class VectorChunk:
    """A stored chunk with its metadata."""
    id: str
    document_id: str
    text: str
    embedding: np.ndarray
    metadata: dict[str, str]


@dataclass(frozen=True, slots=True)
class SearchResult:
    """A chunk returned from similarity search."""
    chunk_id: str
    document_id: str
    text: str
    similarity: float
    metadata: dict[str, str]


class VectorStore(ABC):
    """Abstract vector store interface."""

    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def shutdown(self) -> None: ...

    @abstractmethod
    async def upsert(self, chunks: list[VectorChunk]) -> None:
        """Insert or update chunks. Idempotent on chunk.id."""

    @abstractmethod
    async def search(
        self,
        query_embedding: np.ndarray,
        *,
        top_k: int = 5,
        filter_document_ids: list[str] | None = None,
    ) -> list[SearchResult]:
        """Return the top-k most similar chunks, optionally filtered by document."""

    @abstractmethod
    async def delete_by_document(self, document_id: str) -> int:
        """Delete all chunks for a document. Returns count deleted."""
