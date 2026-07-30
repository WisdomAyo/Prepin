"""
Energy-based speaker diarizer — simple heuristic implementation.

Segments audio by energy levels and turn-taking patterns to identify
who is speaking (user vs. interviewer). This is a baseline heuristic;
upgrade to a neural diarizer (pyannote.audio) for production accuracy.

Strategy:
  - In a two-party conversation, the user's mic captures their voice louder.
  - We split on silence gaps (>500ms) and assign the louder segments to "user"
    and the quieter ones to "interviewer".
  - For system audio loopback, the roles are reversed (interviewer is louder).
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

import numpy as np

from app.providers.diarizer import Diarizer, SpeakerSegment

logger = logging.getLogger(__name__)

SILENCE_THRESHOLD = 0.02  # RMS below this = silence
MIN_SILENCE_MS = 500  # Minimum gap to consider a speaker turn
FRAME_MS = 30  # Analysis frame size


class EnergyDiarizer(Diarizer):
    """Heuristic speaker diarizer based on energy levels."""

    def __init__(self, mic_is_user: bool = True) -> None:
        """
        Args:
            mic_is_user: True if the microphone primarily captures the user's voice
                         (standard mic setup). False for system audio loopback
                         where the captured audio is primarily the interviewer.
        """
        self._mic_is_user = mic_is_user
        self._pool: ThreadPoolExecutor | None = None

    async def initialize(self) -> None:
        self._pool = ThreadPoolExecutor(max_workers=1)
        logger.info("EnergyDiarizer initialized (mic_is_user=%s)", self._mic_is_user)

    async def shutdown(self) -> None:
        if self._pool:
            self._pool.shutdown(wait=False)

    async def identify_speakers(
        self,
        audio_bytes: bytes,
        sample_rate: int = 16000,
    ) -> list[SpeakerSegment]:
        """Segment audio by speaker using energy-based heuristics."""
        assert self._pool is not None
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._pool,
            self._diarize_sync,
            audio_bytes,
            sample_rate,
        )

    def _diarize_sync(
        self,
        audio_bytes: bytes,
        sample_rate: int,
    ) -> list[SpeakerSegment]:
        # Convert to float32
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        frame_samples = int(FRAME_MS / 1000 * sample_rate)
        num_frames = len(audio) // frame_samples

        if num_frames == 0:
            return []

        # Compute RMS energy per frame
        energies: list[float] = []
        for i in range(num_frames):
            frame = audio[i * frame_samples : (i + 1) * frame_samples]
            rms = float(np.sqrt(np.mean(frame ** 2)))
            energies.append(rms)

        # Find silence gaps and segment
        segments: list[SpeakerSegment] = []
        in_speech = False
        speech_start = 0
        silence_count = 0
        min_silence_frames = int(MIN_SILENCE_MS / FRAME_MS)

        # Compute median energy for loud/quiet threshold
        speech_energies = [e for e in energies if e > SILENCE_THRESHOLD]
        if not speech_energies:
            return []
        median_energy = float(np.median(speech_energies))

        for i, energy in enumerate(energies):
            if energy > SILENCE_THRESHOLD:
                if not in_speech:
                    speech_start = i
                    in_speech = True
                silence_count = 0
            else:
                if in_speech:
                    silence_count += 1
                    if silence_count >= min_silence_frames:
                        # End of speech segment
                        seg_start_ms = speech_start * FRAME_MS
                        seg_end_ms = (i - silence_count) * FRAME_MS

                        # Compute average energy for this segment
                        seg_energies = energies[speech_start : i - silence_count]
                        avg_energy = float(np.mean(seg_energies)) if seg_energies else 0

                        # Louder = primary speaker (user for mic, interviewer for loopback)
                        is_loud = avg_energy > median_energy
                        if self._mic_is_user:
                            speaker: Literal["user", "interviewer", "unknown"] = (
                                "user" if is_loud else "interviewer"
                            )
                        else:
                            speaker = "interviewer" if is_loud else "user"

                        confidence = min(1.0, abs(avg_energy - median_energy) / median_energy)

                        segments.append(SpeakerSegment(
                            speaker=speaker,
                            start_ms=seg_start_ms,
                            end_ms=seg_end_ms,
                            confidence=round(confidence, 3),
                        ))

                        in_speech = False
                        silence_count = 0

        # Handle final segment
        if in_speech:
            seg_start_ms = speech_start * FRAME_MS
            seg_end_ms = num_frames * FRAME_MS
            seg_energies = energies[speech_start:]
            avg_energy = float(np.mean(seg_energies)) if seg_energies else 0
            is_loud = avg_energy > median_energy

            if self._mic_is_user:
                speaker = "user" if is_loud else "interviewer"
            else:
                speaker = "interviewer" if is_loud else "user"

            segments.append(SpeakerSegment(
                speaker=speaker,
                start_ms=seg_start_ms,
                end_ms=seg_end_ms,
                confidence=0.5,
            ))

        logger.debug("Diarized %d segments from %d frames", len(segments), num_frames)
        return segments
