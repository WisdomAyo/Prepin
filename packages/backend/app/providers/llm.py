"""
LLMProvider — large-language-model interface.

Every LLM (Ollama, Anthropic, OpenAI) implements this protocol.
The orchestrator depends only on this interface.

Architecture decisions:
- generate() returns the full answer (used for scoring, eval).
- generate_stream() yields tokens for real-time overlay display.
- Both accept the same GroundedPrompt so the caller doesn't touch
  provider-specific prompt formats.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass(frozen=True, slots=True)
class GroundedPrompt:
    """
    A prompt assembled by the orchestrator with clear layering:
      1. system_preamble — cached, contains resume + JD + style rules.
      2. retrieved_context — RAG chunks, delimited and marked untrusted.
      3. user_query — the detected question / moment.

    Instruction hierarchy: system > retrieved facts > user query.
    All retrieved/transcribed text is untrusted — providers must delimit it.
    """
    system_preamble: str
    retrieved_context: list[str] = field(default_factory=list)
    user_query: str = ""


@dataclass(frozen=True, slots=True)
class LLMResponse:
    """Structured response from the LLM, parsed into the output contract."""
    headline: str
    bullets: tuple[str, str, str]
    spoken_version: str | None
    has_assumptions: bool
    raw_text: str
    prompt_tokens: int
    completion_tokens: int


class LLMProvider(ABC):
    """Abstract LLM interface."""

    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def shutdown(self) -> None: ...

    @abstractmethod
    async def generate(self, prompt: GroundedPrompt) -> LLMResponse:
        """Generate a complete grounded answer."""

    @abstractmethod
    async def generate_stream(self, prompt: GroundedPrompt) -> AsyncIterator[str]:
        """Yield tokens as they arrive for real-time display."""
