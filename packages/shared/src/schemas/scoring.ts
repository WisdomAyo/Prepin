import { z } from "zod";

/** Rubric dimensions for scoring a single answer. */
export const RubricDimension = z.enum([
  "structure",
  "specificity",
  "jd_relevance",
  "conciseness",
  "confidence",
]);
export type RubricDimension = z.infer<typeof RubricDimension>;

/** Score for one answer on one dimension. */
export const DimensionScore = z.object({
  dimension: RubricDimension,
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(500),
});
export type DimensionScore = z.infer<typeof DimensionScore>;

/** Full scorecard for a single answer in Prep Mode. */
export const AnswerScore = z.object({
  questionText: z.string(),
  userAnswerText: z.string(),
  dimensions: z.array(DimensionScore),
  overallScore: z.number().min(1).max(5),
  improvementTip: z.string().max(500),
});
export type AnswerScore = z.infer<typeof AnswerScore>;

/** Post-session scorecard aggregating all answers. */
export const SessionScorecard = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(AnswerScore),
  averageScore: z.number().min(1).max(5),
  weakestDimension: RubricDimension,
  /** Question types to drill. */
  drillRecommendations: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export type SessionScorecard = z.infer<typeof SessionScorecard>;

/** Longitudinal tracking — one entry per session. */
export const ScoreHistoryEntry = z.object({
  sessionId: z.string().uuid(),
  date: z.string().datetime(),
  averageScore: z.number().min(1).max(5),
  dimensionAverages: z.record(RubricDimension, z.number().min(1).max(5)),
});
export type ScoreHistoryEntry = z.infer<typeof ScoreHistoryEntry>;
