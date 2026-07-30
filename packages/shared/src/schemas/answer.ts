import { z } from "zod";

/**
 * Output contract — every answer MUST conform to this shape.
 * (1) one-line headline
 * (2) three talking-point bullets
 * (3) optional two-sentence spoken version
 * Never a paragraph.
 */
export const GroundedAnswer = z.object({
  /** The question or moment that triggered this answer. */
  triggerText: z.string(),
  /** One-line headline. */
  headline: z.string().max(200),
  /** Exactly three concise talking-point bullets. */
  bullets: z.tuple([z.string(), z.string(), z.string()]),
  /** Optional two-sentence spoken version. */
  spokenVersion: z.string().max(500).optional(),
  /** Which resume/JD facts were used to ground this answer. */
  groundingSources: z.array(
    z.object({
      documentId: z.string().uuid(),
      chunkText: z.string(),
      similarity: z.number().min(0).max(1),
    })
  ),
  /** Flags content the LLM inferred rather than found in sources. */
  hasAssumptions: z.boolean(),
  /** Provider that generated this answer (for observability). */
  provider: z.string(),
  /** Time from question detection to first token, in ms. */
  latencyMs: z.number().int().nonnegative(),
});
export type GroundedAnswer = z.infer<typeof GroundedAnswer>;
