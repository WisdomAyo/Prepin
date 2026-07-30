"""
Database engine and session factory.

Uses asyncpg via SQLAlchemy async for the control plane.
pgvector extension is enabled on first connect.

Falls back to aiosqlite when Postgres is unavailable (dev convenience).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)

engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None
_using_sqlite: bool = False


async def init_db() -> None:
    global engine, async_session_factory, _using_sqlite

    db_url = settings.database_url

    try:
        engine = create_async_engine(
            db_url,
            echo=settings.log_level == "DEBUG",
            pool_size=10,
            max_overflow=20,
        )
        async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

        # Ensure pgvector extension exists
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

        _using_sqlite = False
        logger.info("Connected to Postgres: %s", db_url)

    except Exception as pg_err:
        logger.warning("Postgres unavailable (%s), falling back to SQLite.", pg_err)

        import os
        db_path = os.path.join(os.path.dirname(__file__), "..", "..", "copilot_dev.db")
        db_path = os.path.abspath(db_path)
        sqlite_url = f"sqlite+aiosqlite:///{db_path}"

        engine = create_async_engine(
            sqlite_url,
            echo=settings.log_level == "DEBUG",
        )
        async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
        _using_sqlite = True
        logger.info("Using SQLite fallback: %s", db_path)

    # Create tables
    from app.db.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized (sqlite=%s).", _using_sqlite)


async def dispose_db() -> None:
    global engine
    if engine:
        await engine.dispose()
        logger.info("Database connections disposed.")


def get_factory() -> async_sessionmaker[AsyncSession]:
    """Get the session factory — always returns the current global."""
    assert async_session_factory is not None, "DB not initialized — call init_db() first"
    return async_session_factory


async def get_session() -> AsyncSession:
    """Dependency for FastAPI route handlers."""
    factory = get_factory()
    async with factory() as session:
        yield session  # type: ignore[misc]
