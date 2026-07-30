"""
Scoring API — post-session scorecards and longitudinal tracking.

Prep Mode flow:
  1. User completes a mock interview session.
  2. Client sends the session's Q&A pairs for scoring.
  3. The cheap LLM scores each answer on the rubric dimensions.
  4. Scorecard is persisted for longitudinal tracking.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

import app.db.engine as db_engine
from app.db.models import SessionScore
import app.providers as providers
from app.providers.llm import GroundedPrompt

logger = logging.getLogger(__name__)
router = APIRouter()


class AnswerForScoring(BaseModel):
    question: str
    user_answer: str


class ScoreRequest(BaseModel):
    session_id: str
    answers: list[AnswerForScoring]
    resume_context: str = ""
    jd_context: str = ""


class DimensionScoreResponse(BaseModel):
    dimension: str
    score: int
    feedback: str


class AnswerScoreResponse(BaseModel):
    question: str
    dimensions: list[DimensionScoreResponse]
    overall_score: float
    improvement_tip: str


class ScorecardResponse(BaseModel):
    session_id: str
    answers: list[AnswerScoreResponse]
    average_score: float
    weakest_dimension: str
    drill_recommendations: list[str]


class ScoreHistoryResponse(BaseModel):
    entries: list[dict]


SCORING_PROMPT = """You are an interview coach scoring a candidate's answer.

Score the answer on these 5 dimensions (1-5 scale):
1. structure: Is the answer well-organized (e.g., STAR format)?
2. specificity: Does it include concrete examples, numbers, or outcomes?
3. jd_relevance: How well does it address what the target role needs?
4. conciseness: Is it appropriately brief without unnecessary filler?
5. confidence: Does the language convey confidence and competence?

Respond in EXACTLY this JSON format:
{
  "dimensions": [
    {"dimension": "structure", "score": N, "feedback": "..."},
    {"dimension": "specificity", "score": N, "feedback": "..."},
    {"dimension": "jd_relevance", "score": N, "feedback": "..."},
    {"dimension": "conciseness", "score": N, "feedback": "..."},
    {"dimension": "confidence", "score": N, "feedback": "..."}
  ],
  "overall_score": N.N,
  "improvement_tip": "One actionable tip to improve."
}"""


@router.post("/scorecard", response_model=ScorecardResponse)
async def generate_scorecard(req: ScoreRequest) -> ScorecardResponse:
    """Score all answers from a prep session and generate a scorecard."""
    if not req.answers:
        raise HTTPException(400, "No answers to score")

    scored_answers: list[AnswerScoreResponse] = []
    all_dimension_totals: dict[str, list[int]] = {
        "structure": [],
        "specificity": [],
        "jd_relevance": [],
        "conciseness": [],
        "confidence": [],
    }

    for answer in req.answers:
        prompt = GroundedPrompt(
            system_preamble=SCORING_PROMPT,
            retrieved_context=[req.resume_context, req.jd_context] if req.resume_context else [],
            user_query=f"Question: {answer.question}\n\nCandidate's Answer: {answer.user_answer}",
        )

        try:
            response = await providers.llm_cheap.generate(prompt)
            # Parse the scoring response
            import re
            cleaned = re.sub(r"```json?\s*", "", response.raw_text)
            cleaned = re.sub(r"```\s*$", "", cleaned).strip()
            data = json.loads(cleaned)

            dimensions = []
            for d in data.get("dimensions", []):
                dim_name = d["dimension"]
                score = max(1, min(5, int(d["score"])))
                dimensions.append(DimensionScoreResponse(
                    dimension=dim_name,
                    score=score,
                    feedback=d.get("feedback", ""),
                ))
                if dim_name in all_dimension_totals:
                    all_dimension_totals[dim_name].append(score)

            scored_answers.append(AnswerScoreResponse(
                question=answer.question,
                dimensions=dimensions,
                overall_score=data.get("overall_score", 3.0),
                improvement_tip=data.get("improvement_tip", ""),
            ))

        except Exception:
            logger.exception("Failed to score answer: %s", answer.question[:50])
            scored_answers.append(AnswerScoreResponse(
                question=answer.question,
                dimensions=[],
                overall_score=0.0,
                improvement_tip="Scoring failed — please try again.",
            ))

    # Compute aggregates
    avg_score = (
        sum(a.overall_score for a in scored_answers) / len(scored_answers)
        if scored_answers
        else 0.0
    )

    dimension_avgs = {
        dim: sum(scores) / len(scores) if scores else 0.0
        for dim, scores in all_dimension_totals.items()
    }
    weakest = min(dimension_avgs, key=lambda k: dimension_avgs[k]) if dimension_avgs else "structure"

    drill_recs = [
        f"Practice {weakest}-focused questions",
        f"Review STAR method for better structure" if weakest == "structure" else f"Add more specific metrics and outcomes" if weakest == "specificity" else f"Study the JD requirements more carefully",
    ]

    # Persist scorecard
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        score_record = SessionScore(
            id=uuid.uuid4(),
            session_id=uuid.UUID(req.session_id),
            average_score=avg_score,
            dimension_averages=dimension_avgs,
            weakest_dimension=weakest,
            drill_recommendations=drill_recs,
            answers_detail=[a.model_dump() for a in scored_answers],
        )
        db.add(score_record)
        await db.commit()

    return ScorecardResponse(
        session_id=req.session_id,
        answers=scored_answers,
        average_score=round(avg_score, 2),
        weakest_dimension=weakest,
        drill_recommendations=drill_recs,
    )


@router.get("/history/{user_id}", response_model=ScoreHistoryResponse)
async def get_score_history(user_id: str) -> ScoreHistoryResponse:
    """Get longitudinal score tracking for a user."""
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        from app.db.models import Session
        result = await db.execute(
            select(SessionScore, Session)
            .join(Session, SessionScore.session_id == Session.id)
            .where(Session.user_id == uuid.UUID(user_id))
            .order_by(SessionScore.created_at.desc())
        )
        rows = result.all()

    entries = [
        {
            "session_id": str(score.session_id),
            "date": score.created_at.isoformat() if score.created_at else "",
            "average_score": score.average_score,
            "dimension_averages": score.dimension_averages,
            "weakest_dimension": score.weakest_dimension,
        }
        for score, _ in rows
    ]

    return ScoreHistoryResponse(entries=entries)
