"""
Tests for the context manager.

Validates:
  - Session context creation and retrieval.
  - Preamble building with resume/JD.
  - Rolling transcript management.
  - Prompt assembly with proper instruction hierarchy.
"""

import pytest
from app.realtime.context_manager import ContextManager, SessionContext


class TestContextManager:
    def setup_method(self) -> None:
        self.mgr = ContextManager()

    def test_create_and_get_session(self) -> None:
        ctx = self.mgr.create_session("test-1", resume_text="I am a dev")
        assert self.mgr.get_session("test-1") is ctx
        assert ctx.resume_text == "I am a dev"

    def test_remove_session(self) -> None:
        self.mgr.create_session("test-2")
        self.mgr.remove_session("test-2")
        assert self.mgr.get_session("test-2") is None

    def test_preamble_includes_resume_and_jd(self) -> None:
        ctx = SessionContext(
            session_id="test",
            resume_text="5 years at Google",
            jd_text="Senior SWE role",
        )
        prompt = ctx.build_prompt("Tell me about yourself", [])
        assert "5 years at Google" in prompt.system_preamble
        assert "Senior SWE role" in prompt.system_preamble

    def test_preamble_without_resume(self) -> None:
        ctx = SessionContext(session_id="test")
        prompt = ctx.build_prompt("Hello?", [])
        assert "No resume provided" in prompt.system_preamble

    def test_rag_chunks_in_retrieved_context(self) -> None:
        ctx = SessionContext(session_id="test")
        chunks = ["I led a team of 5", "Revenue grew 30%"]
        prompt = ctx.build_prompt("Tell me about leadership", chunks)
        assert prompt.retrieved_context == chunks

    def test_transcript_rolling(self) -> None:
        ctx = SessionContext(session_id="test", max_transcript_segments=3)
        for i in range(5):
            ctx.add_transcript_segment(f"segment {i}")
        assert len(ctx.transcript_segments) == 3
        assert ctx.transcript_segments[0] == "segment 2"
        assert "segment 0" in ctx.transcript_summary

    def test_prompt_untrusted_text_separation(self) -> None:
        ctx = SessionContext(session_id="test", resume_text="trusted resume")
        prompt = ctx.build_prompt("user question", ["chunk 1"])
        # System preamble should contain safety rules
        assert "untrusted" in prompt.system_preamble.lower()
        # User query goes to user_query, not system
        assert prompt.user_query == "user question"
