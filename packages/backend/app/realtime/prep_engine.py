"""
Prep Mode Engine — AI mock interview with follow-ups.

Generates contextual interview questions based on the user's resume and JD,
handles follow-up questions, and coordinates with the scoring API for
post-session scorecards.

Architecture decision: the prep engine uses the cheap LLM for question
generation (cost efficiency) and the primary LLM for answer evaluation
(quality). Questions are generated one at a time to enable follow-ups
based on the user's response.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import app.providers as providers
from app.providers.llm import GroundedPrompt

logger = logging.getLogger(__name__)

QUESTION_GEN_PROMPT = """You are an expert interviewer conducting a mock interview.

Based on the candidate's resume and the target job description, generate the next
interview question. Consider what has been asked so far and create a diverse set
of questions covering: behavioral, technical, situational, and role-specific topics.

Previous questions asked:
{previous_questions}

Respond with ONLY the question text, nothing else. No numbering, no preamble."""

FOLLOW_UP_PROMPT = """You are an expert interviewer. Based on the candidate's answer
to the previous question, generate a follow-up question that probes deeper into
their response, asks for more specifics, or explores a related area.

Previous question: {question}
Candidate's answer: {answer}

Respond with ONLY the follow-up question text, nothing else."""


@dataclass
class PrepSession:
    """State for a single prep mode session."""

    session_id: str
    resume_text: str = ""
    jd_text: str = ""
    questions_asked: list[str] = field(default_factory=list)
    answers_given: list[str] = field(default_factory=list)
    max_questions: int = 5
    follow_up_count: int = 0
    max_follow_ups_per_question: int = 1


class PrepEngine:
    """Manages prep mode sessions and generates questions."""

    def __init__(self) -> None:
        self._sessions: dict[str, PrepSession] = {}

    def create_session(
        self,
        session_id: str,
        resume_text: str = "",
        jd_text: str = "",
        max_questions: int = 5,
    ) -> PrepSession:
        session = PrepSession(
            session_id=session_id,
            resume_text=resume_text,
            jd_text=jd_text,
            max_questions=max_questions,
        )
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> PrepSession | None:
        return self._sessions.get(session_id)

    async def generate_question(self, session_id: str) -> str | None:
        """Generate the next interview question."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        if len(session.questions_asked) >= session.max_questions:
            return None  # Session complete

        prev_q = "\n".join(
            f"- {q}" for q in session.questions_asked
        ) or "None yet."

        preamble = f"""You are interviewing for this role:
<jd>{session.jd_text or 'General software engineering role'}</jd>

The candidate's background:
<resume>{session.resume_text or 'Not provided'}</resume>"""

        prompt = GroundedPrompt(
            system_preamble=preamble,
            user_query=QUESTION_GEN_PROMPT.format(previous_questions=prev_q),
        )

        try:
            response = await providers.llm_cheap.generate(prompt)
            question = response.raw_text.strip().strip('"').strip("'")
            session.questions_asked.append(question)
            session.follow_up_count = 0
            return question
        except Exception:
            logger.exception("Failed to generate question")
            return "Tell me about a challenging project you worked on recently."

    async def generate_follow_up(
        self, session_id: str, user_answer: str
    ) -> str | None:
        """Generate a follow-up question based on the user's answer."""
        session = self._sessions.get(session_id)
        if not session or not session.questions_asked:
            return None

        if session.follow_up_count >= session.max_follow_ups_per_question:
            return None  # Move on to next question

        last_question = session.questions_asked[-1]
        session.answers_given.append(user_answer)

        prompt = GroundedPrompt(
            system_preamble="You are an expert interviewer.",
            user_query=FOLLOW_UP_PROMPT.format(
                question=last_question, answer=user_answer
            ),
        )

        try:
            response = await providers.llm_cheap.generate(prompt)
            follow_up = response.raw_text.strip().strip('"').strip("'")
            session.questions_asked.append(follow_up)
            session.follow_up_count += 1
            return follow_up
        except Exception:
            logger.exception("Failed to generate follow-up")
            return None

    def is_complete(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if not session:
            return True
        return len(session.questions_asked) >= session.max_questions

    def remove_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
