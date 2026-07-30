"""
Cloud STT adapter using Deepgram's streaming API.

Connects via WebSocket to Deepgram for real-time transcription.
Falls back to REST API for file-based transcription.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator

import httpx

from app.config import settings
from app.providers.stt import STTProvider, STTSegment

logger = logging.getLogger(__name__)


class DeepgramSTT(STTProvider):
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def initialize(self) -> None:
        self._client = httpx.AsyncClient(
            base_url="https://api.deepgram.com",
            headers={"Authorization": f"Token {settings.deepgram_api_key}"},
            timeout=httpx.Timeout(30.0),
        )
        logger.info("DeepgramSTT initialized.")

    async def shutdown(self) -> None:
        if self._client:
            await self._client.aclose()

    async def transcribe_stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        sample_rate: int = 16000,
        channels: int = 1,
    ) -> AsyncIterator[STTSegment]:
        """
        Stream audio to Deepgram via WebSocket and yield transcript segments.
        Uses the live transcription endpoint with interim results.
        """
        import websockets

        url = (
            f"wss://api.deepgram.com/v1/listen"
            f"?encoding=linear16&sample_rate={sample_rate}&channels={channels}"
            f"&punctuate=true&interim_results=true&model=nova-2"
        )
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}

        async with websockets.connect(url, extra_headers=headers) as ws:
            # Producer: send audio chunks
            async def send_audio() -> None:
                async for chunk in audio_chunks:
                    await ws.send(chunk)
                # Send close message
                await ws.send(json.dumps({"type": "CloseStream"}))

            send_task = asyncio.create_task(send_audio())

            try:
                async for msg in ws:
                    data = json.loads(msg)
                    if data.get("type") != "Results":
                        continue
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if not alternatives:
                        continue
                    alt = alternatives[0]
                    text = alt.get("transcript", "").strip()
                    if not text:
                        continue

                    is_final = data.get("is_final", False)
                    start_ms = int(data.get("start", 0) * 1000)
                    duration_ms = int(data.get("duration", 0) * 1000)

                    yield STTSegment(
                        text=text,
                        start_ms=start_ms,
                        end_ms=start_ms + duration_ms,
                        is_final=is_final,
                        confidence=alt.get("confidence", 0.0),
                    )
            finally:
                send_task.cancel()

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[STTSegment]:
        url = (
            f"https://api.deepgram.com/v1/listen?encoding=linear16"
            f"&sample_rate={sample_rate}&channels=1&punctuate=true&model=nova-2"
        )
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            resp = await client.post(
                url,
                content=audio_bytes,
                headers={
                    "Authorization": f"Token {settings.deepgram_api_key}",
                    "Content-Type": "application/octet-stream",
                },
            )
        resp.raise_for_status()
        data = resp.json()

        segments: list[STTSegment] = []
        for channel in data.get("results", {}).get("channels", []):
            for alt in channel.get("alternatives", []):
                transcript = alt.get("transcript", "").strip()
                if not transcript:
                    continue
                words = alt.get("words", [])
                start_ms = int(words[0]["start"] * 1000) if words else 0
                end_ms = int(words[-1]["end"] * 1000) if words else 0
                segments.append(
                    STTSegment(
                        text=transcript,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        is_final=True,
                        confidence=alt.get("confidence", 0.0),
                    )
                )
        return segments
