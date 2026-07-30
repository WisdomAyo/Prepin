"""
SQLAlchemy ORM models for the control plane.

Ephemeral real-time session data lives in Redis only.
Persistent data (documents, scores, history) lives here.

Models use portable types so they work on both Postgres (production)
and SQLite (dev fallback when Docker is unavailable).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    TypeDecorator,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# ── Portable type adapters ──────────────────────────────────────


class GUID(TypeDecorator):
    """Platform-independent UUID type. Uses PG UUID, falls back to CHAR(36)."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value: Any, dialect: Any) -> uuid.UUID | None:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))


class JSONType(TypeDecorator):
    """Platform-independent JSON. Uses PG JSONB, falls back to TEXT + json."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return value

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())


class VectorType(TypeDecorator):
    """Stores embeddings. Uses pgvector on Postgres, JSON text on SQLite."""
    impl = Text
    cache_ok = True

    def __init__(self, dim: int = 384):
        super().__init__()
        self.dim = dim

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        return json.dumps([float(v) for v in value])

    def process_result_value(self, value: Any, dialect: Any) -> list[float] | None:
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return list(value)

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(self.dim))
            except ImportError:
                pass
        return dialect.type_descriptor(Text())


# ── Models ──────────────────────────────────────────────────────


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Document(Base):
    """An uploaded resume, JD, or account note — chunked and embedded for RAG."""
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[str | None] = mapped_column(String(200))
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    """A single chunk of a document with its vector embedding for RAG."""
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("documents.id"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = Column(VectorType(384))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONType(), default=dict)

    document: Mapped["Document"] = relationship(back_populates="chunks")


class Session(Base):
    """A copilot session (live or prep). Transcript is ephemeral in Redis."""
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    resume_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("documents.id"))
    jd_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("documents.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="sessions")
    scores: Mapped[list["SessionScore"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SessionScore(Base):
    """Longitudinal score tracking — one scorecard per session."""
    __tablename__ = "session_scores"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sessions.id"), nullable=False)
    average_score: Mapped[float] = mapped_column(Float, nullable=False)
    dimension_averages: Mapped[dict | None] = mapped_column(JSONType(), nullable=False)
    weakest_dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    drill_recommendations: Mapped[list | None] = mapped_column(JSONType(), default=list)
    answers_detail: Mapped[list | None] = mapped_column(JSONType(), default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped["Session"] = relationship(back_populates="scores")
