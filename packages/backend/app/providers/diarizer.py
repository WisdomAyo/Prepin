"""
Diarizer — speaker identification interface.

Determines who is speaking (user vs. interviewer) in a multi-speaker stream.
Initially a simple energy/turn-based heuristic; can be upgraded to a
neural diarizer later.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class SpeakerSegment:
    speaker: Literal["user", "interviewer", "unknown"]
    start_ms: int
    end_ms: int
    confidence: float


class Diarizer(ABC):

    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def shutdown(self) -> None: ...

    @abstractmethod
    async def identify_speakers(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[SpeakerSegment]:
        """Segment audio by speaker."""
