"""
Local STT adapter using faster-whisper.

Architecture decision: Whisper inference is CPU-heavy. We run it in a
ProcessPoolExecutor to keep the async event loop free. The streaming
interface accumulates audio in a buffer and transcribes in sliding windows
to provide partial results.
"""

from __future__ import annotations

import asyncio
import io
import logging
from concurrent.futures import ProcessPoolExecutor
from typing import AsyncIterator

import numpy as np

from app.config import settings
from app.providers.stt import STTProvider, STTSegment

logger = logging.getLogger(__name__)

# Module-level model instance for the worker process
_model = None


def _init_model(model_size: str, device: str) -> None:
    """Initialize the Whisper model in a worker process."""
    global _model
    from faster_whisper import WhisperModel
    _model = WhisperModel(model_size, device=device, compute_type="int8")


def _transcribe_sync(audio_np: np.ndarray) -> list[dict]:
    """Run transcription in a worker process — never on the event loop."""
    assert _model is not None
    segments, info = _model.transcribe(audio_np, beam_size=5, language="en")
    results = []
    for seg in segments:
        results.append({
            "text": seg.text.strip(),
            "start_ms": int(seg.start * 1000),
            "end_ms": int(seg.end * 1000),
            "confidence": seg.avg_log_prob,
        })
    return results


class WhisperSTT(STTProvider):
    """faster-whisper based local STT."""

    def __init__(self) -> None:
        self._pool: ProcessPoolExecutor | None = None
        self._buffer: bytearray = bytearray()
        # Process ~2s of audio at a time for partial results
        self._chunk_duration_ms = 2000
        self._sample_rate = 16000

    async def initialize(self) -> None:
        self._pool = ProcessPoolExecutor(
            max_workers=1,
            initializer=_init_model,
            initargs=(settings.whisper_model_size, settings.whisper_device),
        )
        logger.info(
            "WhisperSTT initialized (model=%s, device=%s)",
            settings.whisper_model_size,
            settings.whisper_device,
        )

    async def shutdown(self) -> None:
        if self._pool:
            self._pool.shutdown(wait=False)
            logger.info("WhisperSTT shut down.")

    async def transcribe_stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        sample_rate: int = 16000,
        channels: int = 1,
    ) -> AsyncIterator[STTSegment]:
        """
        Accumulate audio in a buffer, transcribe every ~2s window.
        Yields partial (non-final) segments for live display, then
        final segments when the buffer is flushed.
        """
        assert self._pool is not None
        self._sample_rate = sample_rate
        chunk_bytes = int(self._chunk_duration_ms / 1000 * sample_rate * 2 * channels)

        async for chunk in audio_chunks:
            self._buffer.extend(chunk)

            if len(self._buffer) >= chunk_bytes:
                audio_np = np.frombuffer(bytes(self._buffer), dtype=np.int16).astype(np.float32) / 32768.0

                loop = asyncio.get_running_loop()
                results = await loop.run_in_executor(self._pool, _transcribe_sync, audio_np)

                for r in results:
                    yield STTSegment(
                        text=r["text"],
                        start_ms=r["start_ms"],
                        end_ms=r["end_ms"],
                        is_final=False,
                        confidence=min(1.0, max(0.0, 1.0 + r["confidence"])),
                    )

                self._buffer.clear()

        # Flush remaining buffer as final
        if self._buffer:
            audio_np = np.frombuffer(bytes(self._buffer), dtype=np.int16).astype(np.float32) / 32768.0
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(self._pool, _transcribe_sync, audio_np)
            for r in results:
                yield STTSegment(
                    text=r["text"],
                    start_ms=r["start_ms"],
                    end_ms=r["end_ms"],
                    is_final=True,
                    confidence=min(1.0, max(0.0, 1.0 + r["confidence"])),
                )
            self._buffer.clear()

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[STTSegment]:
        assert self._pool is not None
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(self._pool, _transcribe_sync, audio_np)
        return [
            STTSegment(
                text=r["text"],
                start_ms=r["start_ms"],
                end_ms=r["end_ms"],
                is_final=True,
                confidence=min(1.0, max(0.0, 1.0 + r["confidence"])),
            )
            for r in results
        ]
