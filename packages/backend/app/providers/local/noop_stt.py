from __future__ import annotations

import logging
from typing import AsyncIterator

from app.providers.stt import STTProvider, STTSegment

logger = logging.getLogger(__name__)


class NoOpSTT(STTProvider):
    """Fallback STT that does nothing — used when faster-whisper is unavailable.
    The frontend uses the browser's Web Speech API instead, sending text
    directly over the WebSocket."""

    async def initialize(self) -> None:
        logger.warning(
            "Using NoOpSTT — audio-based transcription disabled. "
            "Install faster-whisper for server-side STT."
        )

    async def shutdown(self) -> None:
        pass

    async def transcribe_stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        sample_rate: int = 16000,
        channels: int = 1,
    ) -> AsyncIterator[STTSegment]:
        async for _ in audio_chunks:
            pass
        return
        yield  # make this a generator

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[STTSegment]:
        return []
