"""
Embedder — text → vector embedding interface.

Used for both ingestion (chunking resume/JD into vectors) and query-time
(embedding the detected question for similarity search).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class Embedder(ABC):
    """Abstract embedding interface."""

    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def shutdown(self) -> None: ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> np.ndarray:
        """
        Embed a batch of texts. Returns shape (len(texts), dim).
        Implementations must be thread-safe — local models should run
        inference off the event loop (e.g., via run_in_executor).
        """

    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension for this model."""
