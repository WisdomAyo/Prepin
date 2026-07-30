/**
 * Zustand store for real-time session state.
 *
 * This is the single source of truth during a live or prep session.
 * It holds the transcript, detected questions, answers, and connection state.
 * Persisted data (documents, history) uses TanStack Query instead.
 */

import { create } from "zustand";

export interface TranscriptSegment {
  id: string;
  speaker: "user" | "interviewer" | "unknown";
  text: string;
  startMs: number;
  isFinal: boolean;
}

export interface DetectedQuestion {
  text: string;
  confidence: number;
  timestampMs: number;
}

export interface GroundedAnswer {
  triggerText: string;
  headline: string;
  bullets: [string, string, string];
  spokenVersion?: string;
  groundingSources: Array<{
    documentId: string;
    chunkText: string;
    similarity: number;
  }>;
  hasAssumptions: boolean;
  provider: string;
  latencyMs: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface SessionState {
  // Connection
  sessionId: string | null;
  status: ConnectionStatus;

  // Transcript
  segments: TranscriptSegment[];
  partialText: string;

  // Questions & Answers
  questions: DetectedQuestion[];
  answers: GroundedAnswer[];
  currentAnswer: GroundedAnswer | null;

  // Recording
  isRecording: boolean;
  stealthMode: boolean;

  // Actions
  setSessionId: (id: string | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  addSegment: (seg: TranscriptSegment) => void;
  setPartialText: (text: string) => void;
  addQuestion: (q: DetectedQuestion) => void;
  addAnswer: (a: GroundedAnswer) => void;
  setCurrentAnswer: (a: GroundedAnswer | null) => void;
  setIsRecording: (recording: boolean) => void;
  setStealthMode: (enabled: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  status: "disconnected" as ConnectionStatus,
  segments: [],
  partialText: "",
  questions: [],
  answers: [],
  currentAnswer: null,
  isRecording: false,
  stealthMode: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setStatus: (status) => set({ status }),

  addSegment: (seg) =>
    set((state) => ({
      segments: [...state.segments, seg],
      partialText: "",
    })),

  setPartialText: (text) => set({ partialText: text }),

  addQuestion: (q) =>
    set((state) => ({ questions: [...state.questions, q] })),

  addAnswer: (a) =>
    set((state) => ({
      answers: state.stealthMode ? [a] : [...state.answers, a],
      currentAnswer: a,
    })),

  setCurrentAnswer: (a) => set({ currentAnswer: a }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setStealthMode: (enabled) => set({ stealthMode: enabled }),
  reset: () => set(initialState),
}));
