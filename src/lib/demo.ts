/**
 * Public demo (DEMO_PUBLIC=1): persona sign-in without an access code, an
 * explicit operator opt-in layered on top of demo auth. Kept dependency-free
 * so src/agent/run.ts (also loaded by the evals CLI outside Next) can import
 * it without dragging in next/headers.
 */
export function publicDemoEnabled(): boolean {
  return process.env.DEMO_PUBLIC === "1";
}
