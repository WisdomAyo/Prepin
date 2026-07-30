/**
 * Hook for Prep Mode — manages the AI question flow.
 *
 * Talks to the /api/v1/prep endpoints for AI-generated questions,
 * follow-ups, and scoring.
 */

import { useState, useCallback } from "react";

const API_BASE = "/api/v1";

interface QAPair {
  question: string;
  answer: string;
  isFollowUp: boolean;
}

interface PrepState {
  sessionId: string | null;
  currentQuestion: string | null;
  questionNumber: number;
  totalQuestions: number;
  isFollowUp: boolean;
  isComplete: boolean;
  isLoading: boolean;
  qaPairs: QAPair[];
  error: string | null;
}

export function usePrepSession() {
  const [state, setState] = useState<PrepState>({
    sessionId: null,
    currentQuestion: null,
    questionNumber: 0,
    totalQuestions: 5,
    isFollowUp: false,
    isComplete: false,
    isLoading: false,
    qaPairs: [],
    error: null,
  });

  const startSession = useCallback(
    async (opts: {
      resumeId?: string;
      jdId?: string;
      maxQuestions?: number;
    }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const res = await fetch(`${API_BASE}/prep/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume_id: opts.resumeId,
            jd_id: opts.jdId,
            max_questions: opts.maxQuestions ?? 5,
          }),
        });
        if (!res.ok) throw new Error("Failed to start prep session");
        const data = await res.json();
        setState((s) => ({
          ...s,
          sessionId: data.session_id,
          currentQuestion: data.question,
          questionNumber: data.question_number,
          totalQuestions: data.total_questions,
          isLoading: false,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [],
  );

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!state.sessionId || !state.currentQuestion) return;

      const pair: QAPair = {
        question: state.currentQuestion,
        answer,
        isFollowUp: state.isFollowUp,
      };

      setState((s) => ({
        ...s,
        isLoading: true,
        qaPairs: [...s.qaPairs, pair],
      }));

      try {
        const res = await fetch(`${API_BASE}/prep/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: state.sessionId,
            answer,
          }),
        });
        if (!res.ok) throw new Error("Failed to submit answer");
        const data = await res.json();

        setState((s) => ({
          ...s,
          currentQuestion: data.question,
          questionNumber: data.question_number,
          totalQuestions: data.total_questions,
          isFollowUp: data.is_follow_up,
          isComplete: data.is_complete,
          isLoading: false,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [state.sessionId, state.currentQuestion, state.isFollowUp],
  );

  const skipQuestion = useCallback(async () => {
    if (!state.sessionId) return;

    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/prep/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: state.sessionId,
          answer: "",
        }),
      });
      if (!res.ok) throw new Error("Failed to skip question");
      const data = await res.json();

      setState((s) => ({
        ...s,
        currentQuestion: data.question,
        questionNumber: data.question_number,
        isFollowUp: data.is_follow_up,
        isComplete: data.is_complete,
        isLoading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [state.sessionId]);

  return {
    ...state,
    startSession,
    submitAnswer,
    skipQuestion,
  };
}
