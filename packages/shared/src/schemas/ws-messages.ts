import { z } from "zod";
import { PartialTranscript } from "./transcript.js";
import { GroundedAnswer } from "./answer.js";

// ── Client → Server ──────────────────────────────────────────

export const AudioChunkMsg = z.object({
  type: z.literal("audio_chunk"),
  /** Base64-encoded PCM/opus audio. */
  data: z.string(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive().default(1),
});
export type AudioChunkMsg = z.infer<typeof AudioChunkMsg>;

export const SessionControlMsg = z.object({
  type: z.enum(["pause", "resume", "end"]),
});
export type SessionControlMsg = z.infer<typeof SessionControlMsg>;

/** Union of all client→server WS messages. */
export const ClientMessage = z.discriminatedUnion("type", [
  AudioChunkMsg,
  SessionControlMsg,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ── Server → Client ──────────────────────────────────────────

export const TranscriptEvent = z.object({
  type: z.literal("transcript"),
  payload: PartialTranscript,
});
export type TranscriptEvent = z.infer<typeof TranscriptEvent>;

export const QuestionDetectedEvent = z.object({
  type: z.literal("question_detected"),
  payload: z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
    timestampMs: z.number().int().nonnegative(),
  }),
});
export type QuestionDetectedEvent = z.infer<typeof QuestionDetectedEvent>;

export const AnswerEvent = z.object({
  type: z.literal("answer"),
  payload: GroundedAnswer,
});
export type AnswerEvent = z.infer<typeof AnswerEvent>;

export const AnswerStreamEvent = z.object({
  type: z.literal("answer_stream"),
  payload: z.object({
    /** Incremental token(s). Empty string = stream complete. */
    delta: z.string(),
    field: z.enum(["headline", "bullet_0", "bullet_1", "bullet_2", "spoken"]),
  }),
});
export type AnswerStreamEvent = z.infer<typeof AnswerStreamEvent>;

export const ErrorEvent = z.object({
  type: z.literal("error"),
  payload: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorEvent = z.infer<typeof ErrorEvent>;

export const SessionSettingsEvent = z.object({
  type: z.literal("session_settings"),
  payload: z.object({
    stealthMode: z.boolean(),
    transcriptVisible: z.boolean(),
    answerPersistence: z.boolean(),
  }),
});
export type SessionSettingsEvent = z.infer<typeof SessionSettingsEvent>;

/** Union of all server→client WS messages. */
export const ServerMessage = z.discriminatedUnion("type", [
  TranscriptEvent,
  QuestionDetectedEvent,
  AnswerEvent,
  AnswerStreamEvent,
  SessionSettingsEvent,
  ErrorEvent,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
