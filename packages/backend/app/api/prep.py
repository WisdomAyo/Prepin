"""
Prep Mode API — AI-generated interview questions with follow-ups.

Endpoints:
  POST /api/v1/prep/start       — start a prep session, get first question
  POST /api/v1/prep/answer      — submit answer, get follow-up or next question
  POST /api/v1/prep/skip        — skip current question
  GET  /api/v1/prep/{session_id} — get current prep session state
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

import app.db.engine as db_engine
from app.db.models import Document
from app.realtime.prep_engine import PrepEngine

router = APIRouter()
prep_engine = PrepEngine()


class StartPrepRequest(BaseModel):
    resume_id: str | None = None
    jd_id: str | None = None
    max_questions: int = 5
    user_id: str = "00000000-0000-0000-0000-000000000000"


class StartPrepResponse(BaseModel):
    session_id: str
    question: str
    question_number: int
    total_questions: int


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class QuestionResponse(BaseModel):
    question: str | None
    question_number: int
    total_questions: int
    is_follow_up: bool
    is_complete: bool


@router.post("/start", response_model=StartPrepResponse)
async def start_prep(req: StartPrepRequest) -> StartPrepResponse:
    """Start a new prep session and get the first AI-generated question."""
    session_id = str(uuid.uuid4())

    # Load resume and JD text
    resume_text = ""
    jd_text = ""
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        if req.resume_id:
            result = await db.execute(
                select(Document).where(Document.id == uuid.UUID(req.resume_id))
            )
            doc = result.scalar_one_or_none()
            if doc:
                resume_text = doc.raw_text

        if req.jd_id:
            result = await db.execute(
                select(Document).where(Document.id == uuid.UUID(req.jd_id))
            )
            doc = result.scalar_one_or_none()
            if doc:
                jd_text = doc.raw_text

    prep_engine.create_session(
        session_id=session_id,
        resume_text=resume_text,
        jd_text=jd_text,
        max_questions=req.max_questions,
    )

    question = await prep_engine.generate_question(session_id)
    if not question:
        raise HTTPException(500, "Failed to generate first question")

    return StartPrepResponse(
        session_id=session_id,
        question=question,
        question_number=1,
        total_questions=req.max_questions,
    )


@router.post("/answer", response_model=QuestionResponse)
async def submit_answer(req: AnswerRequest) -> QuestionResponse:
    """Submit an answer and get the next question or follow-up."""
    session = prep_engine.get_session(req.session_id)
    if not session:
        raise HTTPException(404, "Prep session not found")

    # Try follow-up first
    follow_up = await prep_engine.generate_follow_up(req.session_id, req.answer)
    if follow_up:
        return QuestionResponse(
            question=follow_up,
            question_number=len(session.questions_asked),
            total_questions=session.max_questions,
            is_follow_up=True,
            is_complete=False,
        )

    # No follow-up — generate next question
    if prep_engine.is_complete(req.session_id):
        return QuestionResponse(
            question=None,
            question_number=len(session.questions_asked),
            total_questions=session.max_questions,
            is_follow_up=False,
            is_complete=True,
        )

    next_q = await prep_engine.generate_question(req.session_id)
    return QuestionResponse(
        question=next_q,
        question_number=len(session.questions_asked),
        total_questions=session.max_questions,
        is_follow_up=False,
        is_complete=next_q is None,
    )


@router.post("/skip", response_model=QuestionResponse)
async def skip_question(req: AnswerRequest) -> QuestionResponse:
    """Skip current question and get the next one."""
    session = prep_engine.get_session(req.session_id)
    if not session:
        raise HTTPException(404, "Prep session not found")

    session.answers_given.append("[SKIPPED]")

    if prep_engine.is_complete(req.session_id):
        return QuestionResponse(
            question=None,
            question_number=len(session.questions_asked),
            total_questions=session.max_questions,
            is_follow_up=False,
            is_complete=True,
        )

    next_q = await prep_engine.generate_question(req.session_id)
    return QuestionResponse(
        question=next_q,
        question_number=len(session.questions_asked),
        total_questions=session.max_questions,
        is_follow_up=False,
        is_complete=next_q is None,
    )
