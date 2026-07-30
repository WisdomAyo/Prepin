"""
Question/Moment Detector.

Analyzes the rolling transcript to detect when a question has been asked
or a moment occurs that warrants a suggested answer.

Detection strategy:
  1. Accumulates transcript text into a continuous buffer.
  2. Extracts complete sentences (ending with punctuation).
  3. Heuristic: sentence ends with '?' → high-confidence question.
  4. Pattern: known interview question stems in complete sentences.
  5. LLM: every few segments, sends the recent buffer to the cheap LLM
     to extract coherent questions from fragmented transcript text.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.providers.llm import LLMProvider

logger = logging.getLogger(__name__)

_QUESTION_PATTERNS = [
    r"\btell me about\b",
    r"\bdescribe a (time|situation|project)\b",
    r"\bwhat (is|are|was|were|would|do|did|have)\b",
    r"\bhow (do|did|would|have|are|is)\b",
    r"\bwhy (do|did|would|should|are|is)\b",
    r"\bwhere (do|did|would|have|are|is)\b",
    r"\bwhen (do|did|would|have|are|is)\b",
    r"\bcan you (explain|describe|walk|tell)\b",
    r"\bwhat's your (experience|background|approach|opinion)\b",
    r"\bgive me an example\b",
    r"\bwalk me through\b",
    r"\bhave you ever\b",
    r"\bwhat challenges\b",
    r"\bwhat would you do\b",
    r"\bhow would you (handle|approach|solve|deal)\b",
    r"\bwhat are your (strengths|weaknesses)\b",
    r"\bwhere do you see yourself\b",
    r"\bwhy (are you|do you want|should we)\b",
]

_COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in _QUESTION_PATTERNS]

_MIN_QUESTION_WORDS = 3


@dataclass(frozen=True, slots=True)
class DetectedQuestion:
    text: str
    confidence: float
    timestamp_ms: int
    detection_method: str  # "heuristic", "pattern", "llm"


_LLM_EXTRACT_PROMPT = (
    "You are a question extractor for a live interview transcript. "
    "The transcript may be fragmented (split across small audio chunks). "
    "Extract the most recent complete question or prompt that expects the candidate to respond.\n\n"
    "Rules:\n"
    "- Reconstruct the question from fragments if needed (fix capitalization, missing words).\n"
    "- Only extract questions directed AT the candidate (not rhetorical or self-directed).\n"
    "- If no question is present, return is_question: false.\n\n"
    "Respond with ONLY valid JSON:\n"
    '{{"is_question": true/false, "question_text": "the clean, complete question"}}\n\n'
    "Transcript:\n\"{text}\""
)

_LLM_COOLDOWN_SEGMENTS = 3


class QuestionDetector:
    """
    Stateful detector that accumulates transcript text into a rolling buffer.
    Detects questions from complete sentences, not raw chunk boundaries.
    """

    def __init__(
        self,
        llm_provider: LLMProvider | None = None,
        llm_fallbacks: list[LLMProvider] | None = None,
    ) -> None:
        self._buffer = ""
        self._last_detected: str = ""
        self._llm = llm_provider
        self._llm_fallbacks = llm_fallbacks or []
        self._segment_count = 0
        self._last_llm_segment = 0

    def feed(self, text: str, timestamp_ms: int) -> DetectedQuestion | None:
        text = text.strip()
        if not text:
            return None

        self._segment_count += 1

        # Append to rolling buffer
        self._buffer += " " + text
        # Keep last ~800 chars to have enough context
        if len(self._buffer) > 1000:
            self._buffer = self._buffer[-800:]

        # Extract complete sentences from the buffer
        # A sentence ends with . ? or ! followed by space or end-of-string
        sentences = re.split(r"(?<=[.!?])\s+", self._buffer.strip())

        # Only look at sentences that end with punctuation (complete)
        for sentence in reversed(sentences[-4:]):
            sentence = sentence.strip()
            if not sentence:
                continue

            word_count = len(sentence.split())

            # Fast path: ends with '?'
            if sentence.endswith("?") and word_count >= _MIN_QUESTION_WORDS:
                if self._is_duplicate(sentence):
                    return None
                self._last_detected = sentence
                return DetectedQuestion(
                    text=sentence,
                    confidence=0.95,
                    timestamp_ms=timestamp_ms,
                    detection_method="heuristic",
                )

            # Pattern match — only on complete sentences with enough words
            if sentence[-1] in ".?!" and word_count >= _MIN_QUESTION_WORDS:
                for pattern in _COMPILED_PATTERNS:
                    if pattern.search(sentence):
                        if self._is_duplicate(sentence):
                            return None
                        self._last_detected = sentence
                        return DetectedQuestion(
                            text=sentence,
                            confidence=0.80,
                            timestamp_ms=timestamp_ms,
                            detection_method="pattern",
                        )

        return None

    async def feed_async(self, text: str, timestamp_ms: int) -> DetectedQuestion | None:
        result = self.feed(text, timestamp_ms)
        if result is not None:
            return result

        # LLM classification for ambiguous text — runs every N segments
        if (
            self._llm is not None
            and self._segment_count - self._last_llm_segment >= _LLM_COOLDOWN_SEGMENTS
            and len(self._buffer.split()) >= 8
        ):
            self._last_llm_segment = self._segment_count
            return await self._extract_with_llm(timestamp_ms)

        return None

    async def _extract_with_llm(self, timestamp_ms: int) -> DetectedQuestion | None:
        from app.providers.llm import GroundedPrompt

        recent = self._buffer.strip()[-400:]
        prompt = GroundedPrompt(
            system_preamble="You are a question extractor. Respond with ONLY valid JSON.",
            user_query=_LLM_EXTRACT_PROMPT.format(text=recent),
        )

        # Try primary LLM, then fallbacks
        providers_to_try = []
        if self._llm is not None:
            providers_to_try.append(self._llm)
        providers_to_try.extend(self._llm_fallbacks)

        for provider in providers_to_try:
            try:
                response = await provider.generate(prompt)
                cleaned = re.sub(r"```json?\s*", "", response.raw_text)
                cleaned = re.sub(r"```\s*$", "", cleaned).strip()
                data = json.loads(cleaned)

                if data.get("is_question"):
                    question_text = data.get("question_text", "").strip()
                    if not question_text or len(question_text.split()) < _MIN_QUESTION_WORDS:
                        return None
                    if self._is_duplicate(question_text):
                        return None
                    self._last_detected = question_text
                    return DetectedQuestion(
                        text=question_text,
                        confidence=0.75,
                        timestamp_ms=timestamp_ms,
                        detection_method="llm",
                    )
                return None
            except Exception:
                logger.debug("LLM question extraction failed with %s", type(provider).__name__, exc_info=True)
                continue

        return None

    def _is_duplicate(self, text: str) -> bool:
        if not self._last_detected:
            return False
        # Exact match
        if text == self._last_detected:
            return True
        # High overlap (>70% of words shared)
        new_words = set(text.lower().split())
        old_words = set(self._last_detected.lower().split())
        if not new_words:
            return False
        overlap = len(new_words & old_words) / max(len(new_words), len(old_words))
        return overlap > 0.7

    def reset(self) -> None:
        self._buffer = ""
        self._last_detected = ""
        self._segment_count = 0
        self._last_llm_segment = 0
