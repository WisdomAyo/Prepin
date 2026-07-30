"""
Drill Mode API — targeted practice on weak dimensions.

After a scorecard reveals a weak dimension (e.g., "specificity"),
the user can enter drill mode to get questions specifically designed
to practice that dimension, with focused feedback.

Drill strategy by dimension:
  - structure: "Walk me through..." questions requiring STAR format.
  - specificity: "Give me numbers/metrics..." questions.
  - jd_relevance: Role-specific scenario questions.
  - conciseness: "In 30 seconds, tell me..." timed constraints.
  - confidence: Pressure/challenge questions to practice poise.
"""

from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app.providers as providers
from app.providers.llm import GroundedPrompt

logger = logging.getLogger(__name__)
router = APIRouter()

DRILL_PROMPTS: dict[str, str] = {
    "structure": (
        "Generate an interview question that specifically tests the candidate's "
        "ability to structure their answer using the STAR method (Situation, Task, "
        "Action, Result). The question should require a complex scenario walkthrough. "
        "Respond with ONLY the question text."
    ),
    "specificity": (
        "Generate an interview question that specifically requires the candidate "
        "to provide concrete numbers, metrics, percentages, or measurable outcomes. "
        "The question should be impossible to answer well without specifics. "
        "Respond with ONLY the question text."
    ),
    "jd_relevance": (
        "Generate an interview question that directly tests whether the candidate "
        "understands the specific requirements of the target role and can connect "
        "their experience to those requirements. "
        "Respond with ONLY the question text."
    ),
    "conciseness": (
        "Generate an interview question and add the constraint: 'Please answer in "
        "30 seconds or less.' The question should test the candidate's ability to "
        "be concise while still being substantive. "
        "Respond with ONLY the question text."
    ),
    "confidence": (
        "Generate a challenging, slightly confrontational interview question that "
        "tests the candidate's ability to remain composed and confident under pressure. "
        "Examples: pushback on their experience, devil's advocate scenarios. "
        "Respond with ONLY the question text."
    ),
}

DRILL_FEEDBACK_PROMPT = """You are an interview coach specializing in the "{dimension}" dimension.

Evaluate this answer ONLY on {dimension}:
- Score from 1-5.
- Give specific, actionable feedback on how to improve {dimension} specifically.
- Provide a brief example of what a 5/5 answer would sound like for this dimension.

Respond in JSON: {{"score": N, "feedback": "...", "example": "..."}}"""


class DrillRequest(BaseModel):
    dimension: str
    resume_context: str = ""
    jd_context: str = ""


class DrillQuestionResponse(BaseModel):
    drill_id: str
    dimension: str
    question: str
    tip: str


class DrillAnswerRequest(BaseModel):
    drill_id: str
    dimension: str
    question: str
    answer: str
    resume_context: str = ""
    jd_context: str = ""


class DrillFeedbackResponse(BaseModel):
    dimension: str
    score: int
    feedback: str
    example: str


@router.post("/question", response_model=DrillQuestionResponse)
async def get_drill_question(req: DrillRequest) -> DrillQuestionResponse:
    """Get a drill question targeting a specific weakness dimension."""
    if req.dimension not in DRILL_PROMPTS:
        raise HTTPException(400, f"Invalid dimension. Must be one of: {list(DRILL_PROMPTS.keys())}")

    drill_id = str(uuid.uuid4())

    preamble = "You are an expert interviewer creating practice questions."
    if req.jd_context:
        preamble += f"\n\nTarget role:\n<jd>{req.jd_context[:2000]}</jd>"
    if req.resume_context:
        preamble += f"\n\nCandidate background:\n<resume>{req.resume_context[:2000]}</resume>"

    prompt = GroundedPrompt(
        system_preamble=preamble,
        user_query=DRILL_PROMPTS[req.dimension],
    )

    try:
        response = await providers.llm_cheap.generate(prompt)
        question = response.raw_text.strip().strip('"').strip("'")
    except Exception:
        logger.exception("Failed to generate drill question")
        question = _fallback_question(req.dimension)

    tips = {
        "structure": "Use the STAR method: Situation → Task → Action → Result",
        "specificity": "Include at least 2-3 concrete numbers, metrics, or measurable outcomes",
        "jd_relevance": "Explicitly connect each point to a requirement from the job description",
        "conciseness": "Lead with your strongest point. Cut filler words. Aim for 3 sentences max.",
        "confidence": "Stay composed. Use assertive language. Back claims with evidence.",
    }

    return DrillQuestionResponse(
        drill_id=drill_id,
        dimension=req.dimension,
        question=question,
        tip=tips.get(req.dimension, ""),
    )


@router.post("/feedback", response_model=DrillFeedbackResponse)
async def get_drill_feedback(req: DrillAnswerRequest) -> DrillFeedbackResponse:
    """Get dimension-specific feedback on a drill answer."""
    if req.dimension not in DRILL_PROMPTS:
        raise HTTPException(400, "Invalid dimension")

    prompt = GroundedPrompt(
        system_preamble=DRILL_FEEDBACK_PROMPT.format(dimension=req.dimension),
        retrieved_context=(
            [req.resume_context, req.jd_context] if req.resume_context else []
        ),
        user_query=f"Question: {req.question}\n\nCandidate's Answer: {req.answer}",
    )

    try:
        import json
        import re

        response = await providers.llm_cheap.generate(prompt)
        cleaned = re.sub(r"```json?\s*", "", response.raw_text)
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
        data = json.loads(cleaned)

        return DrillFeedbackResponse(
            dimension=req.dimension,
            score=max(1, min(5, int(data.get("score", 3)))),
            feedback=data.get("feedback", ""),
            example=data.get("example", ""),
        )
    except Exception:
        logger.exception("Failed to generate drill feedback")
        return DrillFeedbackResponse(
            dimension=req.dimension,
            score=0,
            feedback="Feedback generation failed. Please try again.",
            example="",
        )


def _fallback_question(dimension: str) -> str:
    """Static fallback questions if LLM fails."""
    fallbacks = {
        "structure": "Walk me through the most complex project you've led from start to finish.",
        "specificity": "What measurable impact did you have in your last role? Give me specific numbers.",
        "jd_relevance": "Why are you the right fit for this specific role?",
        "conciseness": "In 30 seconds, tell me your biggest professional achievement.",
        "confidence": "Some might say you don't have enough experience for this role. How would you respond?",
    }
    return fallbacks.get(dimension, "Tell me about yourself.")
