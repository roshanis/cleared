/**
 * Choreography for the submit → verdict reveal. The stages are the real
 * pipeline in its real order (two reviewers, then the judge); the pacing
 * only exists so an audience can read what is happening — in heuristic mode
 * the pipeline finishes faster than a person can perceive. Reduced-motion
 * users skip the choreography and get the verdict immediately.
 */

export const REVIEW_STAGES = [
  "Document submitted",
  "Policy reviewer reading",
  "Risk reviewer reading",
  "Judge verifying quotes",
] as const;

export const STAGE_MS = 650;

/** Index of the active stage at a given elapsed time; clamps while a slow model call is still running. */
export function stageIndexAt(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return REVIEW_STAGES.length - 1;
  return Math.min(Math.floor(elapsedMs / STAGE_MS), REVIEW_STAGES.length - 1);
}

/** Whether the choreography has played long enough to reveal the verdict. */
export function theaterDone(elapsedMs: number, reducedMotion: boolean): boolean {
  return reducedMotion || elapsedMs >= REVIEW_STAGES.length * STAGE_MS;
}
