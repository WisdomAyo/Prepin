import { z } from "zod";

export const SpeakerRole = z.enum(["user", "interviewer", "unknown"]);
export type SpeakerRole = z.infer<typeof SpeakerRole>;

/** A single segment of transcribed speech. */
export const TranscriptSegment = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  speaker: SpeakerRole,
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  isFinal: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

/** Partial (streaming) transcript update — sent on the WebSocket. */
export const PartialTranscript = z.object({
  sessionId: z.string().uuid(),
  speaker: SpeakerRole,
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  isFinal: z.boolean(),
});
export type PartialTranscript = z.infer<typeof PartialTranscript>;
