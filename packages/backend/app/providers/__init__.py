"""
Provider registry.

All AI-service code lives behind abstract interfaces defined in this package.
A single PROVIDER_PROFILE env var selects the concrete implementations.
No provider-specific logic leaks outside its adapter module.

Architecture decision: we use a registry pattern rather than a DI container
because the number of providers is small and fixed, and we want explicit
control over initialization order and lifecycle (especially for local
providers that spawn subprocesses).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config import settings, ProviderProfile

if TYPE_CHECKING:
    from app.providers.stt import STTProvider
    from app.providers.llm import LLMProvider
    from app.providers.embedder import Embedder
    from app.providers.vector_store import VectorStore
    from app.providers.diarizer import Diarizer

logger = logging.getLogger(__name__)

# ── Global singletons set at startup ──────────────────────────
stt: STTProvider
llm: LLMProvider
llm_cheap: LLMProvider
llm_fallbacks: list[tuple[LLMProvider, str]]
embedder: Embedder
vector_store: VectorStore
diarizer: Diarizer


async def init_providers() -> None:
    """Instantiate providers based on the active profile."""
    global stt, llm, llm_cheap, llm_fallbacks, embedder, vector_store, diarizer

    llm_fallbacks = []
    profile = settings.provider_profile
    logger.info("Initializing providers for profile=%s", profile.value)

    # Diarizer is the same for both profiles (energy-based heuristic)
    from app.providers.local.energy_diarizer import EnergyDiarizer

    if profile == ProviderProfile.LOCAL:
        from app.providers.local.ollama_llm import OllamaLLM
        from app.providers.local.local_embedder import LocalEmbedder
        from app.providers.local.pg_vector_store import PgVectorStore

        try:
            from app.providers.local.whisper_stt import WhisperSTT
            stt = WhisperSTT()
        except Exception:
            logger.warning("faster-whisper unavailable, using NoOpSTT (browser Speech API will be used)")
            from app.providers.local.noop_stt import NoOpSTT
            stt = NoOpSTT()
        llm = OllamaLLM(model=settings.ollama_model)
        llm_cheap = llm  # local profile uses the same model for both
        embedder = LocalEmbedder(model_name=settings.local_embed_model)
        vector_store = PgVectorStore()
        diarizer = EnergyDiarizer(mic_is_user=True)
    else:
        from app.providers.cloud.anthropic_llm import AnthropicLLM
        from app.providers.local.local_embedder import LocalEmbedder
        from app.providers.local.pg_vector_store import PgVectorStore

        try:
            from app.providers.cloud.deepgram_stt import DeepgramSTT
            if settings.deepgram_api_key:
                stt = DeepgramSTT()
            else:
                raise ValueError("No Deepgram API key")
        except Exception:
            try:
                from app.providers.local.whisper_stt import WhisperSTT
                stt = WhisperSTT()
                logger.info("Deepgram unavailable, using faster-whisper for STT")
            except Exception:
                logger.warning("No STT provider available, using NoOpSTT")
                from app.providers.local.noop_stt import NoOpSTT
                stt = NoOpSTT()
        llm = AnthropicLLM(model=settings.anthropic_model)
        llm_cheap = AnthropicLLM(model=settings.anthropic_cheap_model)

        if settings.gemini_api_key:
            from app.providers.cloud.gemini_llm import GeminiLLM
            llm_fallbacks.append((GeminiLLM(model=settings.gemini_model), "gemini"))
            llm_fallbacks.append((GeminiLLM(model=settings.gemini_cheap_model), "gemini_cheap"))
        if settings.openai_api_key:
            from app.providers.cloud.openai_llm import OpenAILLM
            llm_fallbacks.append((OpenAILLM(), "openai"))

        embedder = LocalEmbedder(model_name=settings.local_embed_model)
        vector_store = PgVectorStore()
        diarizer = EnergyDiarizer(mic_is_user=True)

    for name, provider in [
        ("stt", stt),
        ("llm", llm),
        ("llm_cheap", llm_cheap if llm_cheap is not llm else None),
        ("embedder", embedder),
        ("vector_store", vector_store),
        ("diarizer", diarizer),
    ]:
        if provider is None:
            continue
        try:
            await provider.initialize()
        except Exception:
            logger.warning("Provider %s failed to initialize — continuing anyway", name, exc_info=True)

    for fb_provider, fb_name in llm_fallbacks:
        try:
            await fb_provider.initialize()
        except Exception:
            logger.warning("Fallback provider %s failed to initialize", fb_name, exc_info=True)

    logger.info("Provider initialization complete.")


async def shutdown_providers() -> None:
    """Gracefully shut down all providers."""
    for provider in [stt, llm, llm_cheap, embedder, vector_store, diarizer]:
        try:
            await provider.shutdown()
        except Exception:
            logger.exception("Error shutting down %s", type(provider).__name__)
    for fb_provider, _ in llm_fallbacks:
        try:
            await fb_provider.shutdown()
        except Exception:
            logger.exception("Error shutting down %s", type(fb_provider).__name__)
