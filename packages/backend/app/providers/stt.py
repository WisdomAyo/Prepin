"""
STTProvider — speech-to-text interface.

Every STT implementation (local Whisper, Deepgram, AssemblyAI) implements
this protocol. The real-time pipeline only depends on this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass(frozen=True, slots=True)
class STTSegment:
    """A segment of transcribed speech."""
    text: str
    start_ms: int
    end_ms: int
    is_final: bool
    confidence: float


class STTProvider(ABC):
    """Abstract STT interface. Implementations live in providers/local/ or providers/cloud/."""

    @abstractmethod
    async def initialize(self) -> None:
        """Load models, establish connections."""

    @abstractmethod
    async def shutdown(self) -> None:
        """Release resources."""

    @abstractmethod
    async def transcribe_stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        sample_rate: int = 16000,
        channels: int = 1,
    ) -> AsyncIterator[STTSegment]:
        """
        Accept a stream of raw PCM audio chunks and yield transcript segments
        as they become available. Must support partial (non-final) results for
        live display, followed by final consolidated segments.
        """

    @abstractmethod
    async def transcribe_file(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[STTSegment]:
        """Batch-transcribe a complete audio file. Used for eval and replays."""
