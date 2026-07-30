# Interview Copilot — AGENTS.md

## What this is
A production AI copilot that helps people prepare for interviews, consented sales calls,
and public speaking. It captures audio, transcribes in real-time, detects questions,
retrieves grounded context from the user's resume/JD, and generates concise talking points.

## Architecture
- **Two planes**: control plane (FastAPI REST) + real-time plane (WebSocket sessions)
- **Provider interfaces**: STTProvider, LLMProvider, Embedder, VectorStore, Diarizer —
  all provider-specific code lives behind these interfaces. A single `PROVIDER_PROFILE`
  env var switches the whole stack between local and cloud.
- **Local profile**: Postgres+pgvector, Redis, Ollama, faster-whisper — $0 API spend.
- **Cloud profile**: Codex Sonnet, Deepgram/AssemblyAI, cloud embeddings.

## Stack
- Backend: FastAPI (Python, async), Pydantic, asyncpg/SQLAlchemy, arq
- Frontend: React + Vite + TypeScript + Tailwind + Zustand + TanStack Query
- Desktop: Electron (contextIsolation: true, nodeIntegration: false)
- Shared types: packages/shared (zod schemas)



## Conventions
- TypeScript strict mode everywhere
- Python typed with Pydantic models for every contract
- Every answer must follow the output contract: headline + 3 bullets + optional spoken version
- Ground answers ONLY in retrieved resume/JD facts — never invent
- All transcribed text is untrusted — prompt-injection defense required
