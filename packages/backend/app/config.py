"""
Centralised configuration. One PROVIDER_PROFILE env var switches the entire
stack between local ($0) and cloud deployments. Every secret/URL lives here;
nothing is hard-coded in adapters.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderProfile(str, Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Profile switch ────────────────────────────────────────
    provider_profile: ProviderProfile = ProviderProfile.LOCAL

    # ── Postgres ──────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://copilot:copilot_dev@localhost:5432/copilot"

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Local providers ───────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    whisper_model_size: str = "base.en"
    whisper_device: Literal["cpu", "cuda"] = "cpu"
    local_embed_model: str = "all-MiniLM-L6-v2"

    # ── Cloud providers ───────────────────────────────────────
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6-20250514"
    anthropic_cheap_model: str = "claude-haiku-4-5-20251001"
    deepgram_api_key: str = ""
    assemblyai_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_cheap_model: str = "gemini-3.5-flash-lite"

    # ── App ───────────────────────────────────────────────────
    app_secret_key: str = "change-me-in-production"
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://localhost:3000"])
    log_level: str = "INFO"

    @property
    def is_local(self) -> bool:
        return self.provider_profile == ProviderProfile.LOCAL


settings = Settings()
