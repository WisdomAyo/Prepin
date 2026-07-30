import { z } from "zod";

/** The two modes the copilot operates in. */
export const SessionMode = z.enum(["live", "prep"]);
export type SessionMode = z.infer<typeof SessionMode>;

export const SessionStatus = z.enum(["active", "paused", "ended"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const CreateSessionRequest = z.object({
  mode: SessionMode,
  /** ID of the resume document to ground answers on. */
  resumeId: z.string().uuid().optional(),
  /** ID of the JD / account-note document. */
  jdId: z.string().uuid().optional(),
  /** Free-form context the user wants the AI to know. */
  additionalContext: z.string().max(4000).optional(),
  /** Privacy-focused live-session mode. */
  stealthMode: z.boolean().default(false),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const Session = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mode: SessionMode,
  status: SessionStatus,
  resumeId: z.string().uuid().nullable(),
  jdId: z.string().uuid().nullable(),
  stealthMode: z.boolean(),
  createdAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
});
export type Session = z.infer<typeof Session>;
