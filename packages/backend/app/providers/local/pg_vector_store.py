"""
pgvector-based vector store.

Uses SQLAlchemy async to query the document_chunks table with
cosine similarity. This adapter is used in both local and cloud profiles.
"""

from __future__ import annotations

import logging
import uuid

import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.engine as db_engine
from app.db.models import DocumentChunk
from app.providers.vector_store import SearchResult, VectorChunk, VectorStore

logger = logging.getLogger(__name__)


class PgVectorStore(VectorStore):
    async def initialize(self) -> None:
        logger.info("PgVectorStore initialized.")

    async def shutdown(self) -> None:
        pass

    async def upsert(self, chunks: list[VectorChunk]) -> None:
        assert db_engine.async_session_factory is not None
        async with db_engine.async_session_factory() as session:
            for chunk in chunks:
                obj = DocumentChunk(
                    id=uuid.UUID(chunk.id),
                    document_id=uuid.UUID(chunk.document_id),
                    chunk_index=int(chunk.metadata.get("chunk_index", 0)),
                    text=chunk.text,
                    embedding=chunk.embedding.tolist(),
                    metadata_=chunk.metadata,
                )
                await session.merge(obj)
            await session.commit()
        logger.debug("Upserted %d chunks", len(chunks))

    async def search(
        self,
        query_embedding: np.ndarray,
        *,
        top_k: int = 5,
        filter_document_ids: list[str] | None = None,
    ) -> list[SearchResult]:
        _using_sqlite = db_engine._using_sqlite
        assert db_engine.async_session_factory is not None
        embedding_list = query_embedding.tolist()

        if _using_sqlite:
            return await self._search_sqlite(embedding_list, top_k, filter_document_ids)

        async with db_engine.async_session_factory() as session:
            # Build raw SQL for cosine similarity with pgvector
            filter_clause = ""
            params: dict = {"embedding": str(embedding_list), "top_k": top_k}

            if filter_document_ids:
                placeholders = ", ".join(f":doc_{i}" for i in range(len(filter_document_ids)))
                filter_clause = f"AND document_id IN ({placeholders})"
                for i, doc_id in enumerate(filter_document_ids):
                    params[f"doc_{i}"] = doc_id

            query = text(f"""
                SELECT id, document_id, text, metadata,
                       1 - (embedding <=> :embedding::vector) AS similarity
                FROM document_chunks
                WHERE 1=1 {filter_clause}
                ORDER BY embedding <=> :embedding::vector
                LIMIT :top_k
            """)

            result = await session.execute(query, params)
            rows = result.fetchall()

        return [
            SearchResult(
                chunk_id=str(row.id),
                document_id=str(row.document_id),
                text=row.text,
                similarity=float(row.similarity),
                metadata=row.metadata or {},
            )
            for row in rows
        ]

    async def _search_sqlite(
        self,
        query_embedding: list[float],
        top_k: int,
        filter_document_ids: list[str] | None,
    ) -> list[SearchResult]:
        """Fallback cosine similarity search for SQLite (no pgvector)."""
        import json
        assert db_engine.async_session_factory is not None
        query_vec = np.array(query_embedding)

        async with db_engine.async_session_factory() as session:
            stmt = select(DocumentChunk)
            if filter_document_ids:
                uuids = [uuid.UUID(d) for d in filter_document_ids]
                stmt = stmt.where(DocumentChunk.document_id.in_(uuids))
            result = await session.execute(stmt)
            chunks = result.scalars().all()

        scored = []
        for chunk in chunks:
            if chunk.embedding is None:
                continue
            emb = chunk.embedding if isinstance(chunk.embedding, list) else json.loads(chunk.embedding)
            chunk_vec = np.array(emb)
            dot = np.dot(query_vec, chunk_vec)
            norm = np.linalg.norm(query_vec) * np.linalg.norm(chunk_vec)
            sim = float(dot / norm) if norm > 0 else 0.0
            scored.append((chunk, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [
            SearchResult(
                chunk_id=str(c.id),
                document_id=str(c.document_id),
                text=c.text,
                similarity=sim,
                metadata=c.metadata_ or {},
            )
            for c, sim in scored[:top_k]
        ]

    async def delete_by_document(self, document_id: str) -> int:
        assert db_engine.async_session_factory is not None
        async with db_engine.async_session_factory() as session:
            result = await session.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.document_id == uuid.UUID(document_id)
                )
            )
            await session.commit()
            count = result.rowcount  # type: ignore[union-attr]
            logger.info("Deleted %d chunks for document %s", count, document_id)
            return count
