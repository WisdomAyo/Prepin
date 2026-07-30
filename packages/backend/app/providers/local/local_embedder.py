"""
Local embedding adapter using sentence-transformers.

Runs the embedding model in a thread pool to avoid blocking the event loop.
The same adapter is used in both local and cloud profiles (embeddings are
cheap enough to always run locally).
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial

import numpy as np

from app.providers.embedder import Embedder

logger = logging.getLogger(__name__)


class LocalEmbedder(Embedder):
    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self._model_name = model_name
        self._model = None
        self._pool: ThreadPoolExecutor | None = None
        self._dim: int = 384  # default for MiniLM-L6-v2

    async def initialize(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            logger.warning(
                "sentence-transformers not installed — embedder will return random vectors. "
                "Install with: pip install sentence-transformers"
            )
            self._model = None
            return

        self._pool = ThreadPoolExecutor(max_workers=2)
        loop = asyncio.get_running_loop()
        self._model = await loop.run_in_executor(
            self._pool,
            partial(SentenceTransformer, self._model_name),
        )
        self._dim = self._model.get_sentence_embedding_dimension()
        logger.info("LocalEmbedder initialized (model=%s, dim=%d)", self._model_name, self._dim)

    async def shutdown(self) -> None:
        if self._pool:
            self._pool.shutdown(wait=False)

    def dimension(self) -> int:
        return self._dim

    async def embed(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            # Fallback: return random embeddings (for dev without sentence-transformers)
            logger.warning("Using random embeddings — install sentence-transformers for real ones.")
            return np.random.randn(len(texts), self._dim).astype(np.float32)

        assert self._pool is not None
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(
            self._pool,
            partial(self._model.encode, texts, normalize_embeddings=True),
        )
        return np.asarray(embeddings, dtype=np.float32)
