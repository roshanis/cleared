import { NextResponse } from "next/server";
import { activeReviewer } from "@/agent/run";
import { getDriver } from "@/lib/db/index";
import { getDb } from "@/lib/store";

/**
 * GET /api/health
 *
 * No authentication required — intended for uptime monitors and the
 * client-onboarding smoke check (`curl /api/health`).
 *
 * Response fields:
 *   ok            — always true when the server is healthy
 *   storage       — driver kind: "memory" | "sqlite" | "postgres"
 *   reviewerMode  — "model" | "heuristic" (activeReviewer())
 *   schemaVersion — current schema_version from the meta table
 *   time          — server UTC time (ISO 8601)
 *
 * No secrets, credentials, or internal URLs are included in the response.
 */
export async function GET(): Promise<NextResponse> {
  // Force store initialization (and any pending schema migration) before
  // reading the version — a cold instance's first health probe must report
  // the post-migration state, not the row as it stood before boot.
  await getDb();
  const driver = getDriver();
  const schemaVersion = await driver.schemaVersion();

  return NextResponse.json({
    ok: true,
    storage: driver.kind,
    reviewerMode: activeReviewer(),
    schemaVersion,
    time: new Date().toISOString(),
  });
}
