/**
 * Shared UI components used by both the web frontend and the Electron renderer.
 *
 * Architecture decision: keeping a separate UI package allows the desktop
 * overlay to render the same AnswerCard / TranscriptLine components without
 * duplicating code. The package exports pure React components with no
 * platform-specific dependencies.
 */

export { StatusDot } from "./StatusDot.js";
export { Badge } from "./Badge.js";
export { ScoreBar } from "./ScoreBar.js";
export { CompactAnswerCard } from "./CompactAnswerCard.js";
