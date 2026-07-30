"""
LLM Orchestrator.

The central coordinator for generating grounded answers:
  1. Receives a detected question + session context.
  2. Retrieves RAG chunks from the user's documents.
  3. Builds a grounded prompt with proper instruction hierarchy.
  4. Calls the LLM with circuit-breaker fallback.
  5. Parses the structured output contract.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from app.config import settings, ProviderProfile
import app.providers as providers
from app.providers.llm import GroundedPrompt, LLMProvider, LLMResponse
from app.realtime.context_manager import SessionContext
from app.realtime.rag_retriever import RetrievedChunk, retrieve_for_question

logger = logging.getLogger(__name__)

# Circuit breaker: skip providers that failed recently
_failed_providers: dict[str, float] = {}
_CIRCUIT_BREAKER_COOLDOWN = 120.0  # seconds before retrying a failed provider


@dataclass
class OrchestratorResult:
    """The result of a full orchestration cycle."""
    response: LLMResponse
    chunks_used: list[RetrievedChunk]
    provider_used: str
    latency_ms: int


async def generate_answer(
    question_text: str,
    ctx: SessionContext,
    document_ids: list[str],
) -> OrchestratorResult:
    t0 = time.monotonic()

    chunks = await retrieve_for_question(question_text, document_ids)
    chunk_texts = [c.text for c in chunks]

    prompt = ctx.build_prompt(question_text, chunk_texts)

    response, provider_name = await _generate_with_fallback(prompt)

    latency_ms = int((time.monotonic() - t0) * 1000)
    if ctx.stealth_mode:
        logger.info("Answer generated in %dms via %s: [redacted]", latency_ms, provider_name)
    else:
        logger.info("Answer generated in %dms via %s: %s", latency_ms, provider_name, response.headline[:60])

    return OrchestratorResult(
        response=response,
        chunks_used=chunks,
        provider_used=provider_name,
        latency_ms=latency_ms,
    )


def _is_tripped(name: str) -> bool:
    fail_time = _failed_providers.get(name)
    if fail_time is None:
        return False
    if time.monotonic() - fail_time > _CIRCUIT_BREAKER_COOLDOWN:
        del _failed_providers[name]
        return False
    return True


async def _try_provider(provider: LLMProvider, name: str, prompt: GroundedPrompt) -> tuple[LLMResponse, str] | None:
    if _is_tripped(name):
        return None
    try:
        response = await provider.generate(prompt)
        # Success — clear any previous failure
        _failed_providers.pop(name, None)
        return response, name
    except Exception:
        logger.warning("LLM provider '%s' failed, marking circuit open.", name)
        _failed_providers[name] = time.monotonic()
        return None


async def _generate_with_fallback(prompt: GroundedPrompt) -> tuple[LLMResponse, str]:
    provider_list: list[tuple[LLMProvider, str]] = []

    if settings.provider_profile == ProviderProfile.LOCAL:
        provider_list = [(providers.llm, "local")]
    else:
        provider_list = [
            (providers.llm, "primary"),
            (providers.llm_cheap, "cheap"),
        ]
        provider_list.extend(providers.llm_fallbacks)

    for provider, name in provider_list:
        result = await _try_provider(provider, name, prompt)
        if result is not None:
            return result

    # Last resort: local Ollama
    if settings.provider_profile == ProviderProfile.CLOUD:
        try:
            from app.providers.local.ollama_llm import OllamaLLM
            fallback = OllamaLLM()
            await fallback.initialize()
            try:
                response = await fallback.generate(prompt)
                return response, "local_fallback"
            finally:
                await fallback.shutdown()
        except Exception:
            logger.exception("All LLM providers failed including local fallback.")

    return LLMResponse(
        headline="Unable to generate answer — all providers unavailable",
        bullets=("Please check your connection and try again.", "", ""),
        spoken_version=None,
        has_assumptions=False,
        raw_text="",
        prompt_tokens=0,
        completion_tokens=0,
    ), "none"
