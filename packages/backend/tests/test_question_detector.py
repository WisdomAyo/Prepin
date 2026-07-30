"""
Tests for the question detector.

Validates the layered detection strategy:
  1. Heuristic: question marks
  2. Pattern: interview question stems
  3. Deduplication: same question not detected twice
"""

import pytest
from app.realtime.question_detector import QuestionDetector


class TestQuestionDetector:
    def setup_method(self) -> None:
        self.detector = QuestionDetector()

    def test_detects_question_mark(self) -> None:
        result = self.detector.feed("What is your greatest strength?", 1000)
        assert result is not None
        assert result.detection_method == "heuristic"
        assert result.confidence == 0.95
        assert "greatest strength" in result.text

    def test_detects_pattern_without_question_mark(self) -> None:
        result = self.detector.feed("Tell me about a time when you led a team.", 2000)
        assert result is not None
        assert result.detection_method == "pattern"
        assert result.confidence == 0.80

    def test_no_detection_for_statement(self) -> None:
        result = self.detector.feed("I worked at Google for three years.", 3000)
        assert result is None

    def test_deduplication(self) -> None:
        q1 = self.detector.feed("What is your greatest strength?", 1000)
        q2 = self.detector.feed("What is your greatest strength?", 2000)
        assert q1 is not None
        assert q2 is None  # Same question — deduped

    def test_sliding_window(self) -> None:
        self.detector.feed("So I wanted to ask you", 1000)
        result = self.detector.feed("about your experience?", 2000)
        # Window combines segments — should detect the question
        assert result is not None

    def test_reset_clears_state(self) -> None:
        self.detector.feed("What is your name?", 1000)
        self.detector.reset()
        result = self.detector.feed("What is your name?", 2000)
        assert result is not None  # Same question, but after reset

    def test_multiple_questions_in_sequence(self) -> None:
        q1 = self.detector.feed("What is your name?", 1000)
        q2 = self.detector.feed("Where do you live?", 2000)
        assert q1 is not None
        assert q2 is not None
        assert q1.text != q2.text

    def test_walk_me_through_pattern(self) -> None:
        result = self.detector.feed(
            "Can you walk me through your resume.", 1000
        )
        assert result is not None
        assert result.detection_method == "pattern"
