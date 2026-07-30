"""
Screenshot analysis API — multimodal image analysis via Gemini.

Accepts a screenshot (PNG/JPEG) of an interview screen and returns
AI-powered analysis using the output contract format (headline + bullets).

Use cases:
  - Coding question on screen: provide solution approach
  - System design diagram: explain architecture
  - Behavioral question visible: provide talking points
"""

from __future__ import annotations

import base64
import json
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

_ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}

_SCREENSHOT_SYSTEM_PROMPT = """\
You are an interview copilot analyzing a screenshot from an active interview session.

Analyze the screenshot and provide a helpful, concise response:
- If it's a coding question: provide the solution approach, key algorithm, and time/space complexity.
- If it's a system design diagram: explain the architecture, identify components, and note trade-offs.
- If it's a behavioral question on screen: provide structured talking points using the STAR method.
- If it's a technical concept: give a clear, interview-ready explanation.
- For any other visual: describe what's relevant and how it applies to the interview.

Ground your answer ONLY in what is visible in the screenshot. Do NOT invent information.

You MUST respond in EXACTLY this JSON format and nothing else:
{
  "headline": "one-line headline (max 200 chars)",
  "bullets": ["point 1", "point 2", "point 3"],
  "spoken": "Optional two-sentence spoken version.",
  "has_assumptions": false
}

Rules:
- Keep bullets concise — each under 100 characters.
- The spoken version should be natural, as if spoken aloud.
- Set has_assumptions to true if you inferred anything not directly visible.
"""


class ScreenshotAnalysisResponse(BaseModel):
    headline: str
    bullets: list[str]
    spoken_version: str | None = None
    has_assumptions: bool = False
    prompt_tokens: int = 0
    completion_tokens: int = 0


def _build_gemini_request(
    image_b64: str,
    mime_type: str,
    question: str | None,
    context: str | None,
) -> dict:
    """Build the Gemini multimodal request payload."""
    parts: list[dict] = [
        {"inline_data": {"mime_type": mime_type, "data": image_b64}},
    ]

    user_text = "Analyze this screenshot from an interview session."
    if question:
        user_text += f"\n\nSpecific question: {question}"
    if context:
        user_text += f"\n\nAdditional context: {context}"
    user_text += "\n\nRespond with the JSON output contract."

    parts.append({"text": user_text})

    return {
        "system_instruction": {"parts": [{"text": _SCREENSHOT_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "maxOutputTokens": 1024,
            "temperature": 0.3,
        },
    }


def _parse_response(raw: str, usage: dict) -> ScreenshotAnalysisResponse:
    """Parse the Gemini response into the output contract."""
    cleaned = re.sub(r"```json?\s*", "", raw)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return ScreenshotAnalysisResponse(
            headline=raw[:200],
            bullets=[raw[:100]],
            spoken_version=None,
            has_assumptions=True,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
        )

    bullets = data.get("bullets", ["", "", ""])
    while len(bullets) < 3:
        bullets.append("")

    return ScreenshotAnalysisResponse(
        headline=data.get("headline", "")[:200],
        bullets=bullets[:3],
        spoken_version=data.get("spoken"),
        has_assumptions=data.get("has_assumptions", False),
        prompt_tokens=usage.get("promptTokenCount", 0),
        completion_tokens=usage.get("candidatesTokenCount", 0),
    )


async def analyze_screenshot_image(
    image_b64: str,
    mime_type: str,
    question: str | None = None,
    context: str | None = None,
) -> ScreenshotAnalysisResponse:
    """
    Send a base64-encoded image to Gemini for multimodal analysis.

    Shared by both the REST endpoint and the WebSocket handler.
    """
    api_key = settings.gemini_api_key
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    model = settings.gemini_model
    url = f"{_BASE_URL}/models/{model}:generateContent"
    req = _build_gemini_request(image_b64, mime_type, question, context)

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        resp = await client.post(url, params={"key": api_key}, json=req)

    if resp.status_code != 200:
        logger.error("Gemini API error %d: %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API returned status {resp.status_code}",
        )

    data = resp.json()

    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        logger.error("Unexpected Gemini response structure: %s", data)
        raise HTTPException(status_code=502, detail="Unexpected Gemini response format")

    usage = data.get("usageMetadata", {})
    return _parse_response(raw_text, usage)


@router.post("/analyze", response_model=ScreenshotAnalysisResponse)
async def analyze_screenshot(
    image: UploadFile = File(..., description="Screenshot image (PNG/JPEG)"),
    question: Optional[str] = Form(None, description="Specific question about the image"),
    context: Optional[str] = Form(None, description="Additional context (e.g., 'system design interview')"),
    session_id: Optional[str] = Form(None, description="Session ID to link with"),
) -> ScreenshotAnalysisResponse:
    """
    Analyze a screenshot from an interview session using Gemini multimodal AI.

    Accepts an image file and optional text query. Returns structured analysis
    following the output contract: headline + 3 bullets + optional spoken version.
    """
    # Validate content type
    content_type = image.content_type or "application/octet-stream"
    if content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {content_type}. Allowed: {', '.join(_ALLOWED_MIME_TYPES)}",
        )

    # Read and encode image
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Cap at 20 MB to avoid excessive API costs
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20 MB)")

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    logger.info(
        "Screenshot analysis: type=%s size=%d question=%s session=%s",
        content_type,
        len(image_bytes),
        question[:80] if question else None,
        session_id,
    )

    return await analyze_screenshot_image(image_b64, content_type, question, context)
