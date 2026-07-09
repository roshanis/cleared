import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { getDb, publishRubric } from "@/lib/store";

const bodySchema = z.object({
  version: z.number().int(),
  acknowledgeUnexercisedCriteria: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json(
      { error: "Only compliance leads can publish." },
      { status: 403 },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const db = await getDb();
  const rubric = db.rubrics.find((r) => r.version === parsed.data.version);
  const unexercisedCount = rubric?.goldenGate?.unexercisedCriteria?.length ?? 0;
  if (
    rubric?.goldenGate?.pass &&
    unexercisedCount > 0 &&
    !parsed.data.acknowledgeUnexercisedCriteria
  ) {
    return NextResponse.json(
      {
        error: `Acknowledge that the demo reviewer did not exercise ${unexercisedCount} criterion${unexercisedCount === 1 ? "" : "s"} before publishing.`,
      },
      { status: 409 },
    );
  }
  const published = await publishRubric(parsed.data.version);
  if (!published) {
    return NextResponse.json(
      { error: "Run a passing golden-set gate before publishing." },
      { status: 409 },
    );
  }
  return NextResponse.json({ version: published.version });
}
