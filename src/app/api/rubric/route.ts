import { NextResponse } from "next/server";
import { rubricDraftSchema } from "@/lib/rubric";
import { getSession } from "@/lib/session";
import { saveRubricDraft } from "@/lib/store";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json(
      { error: "Only compliance leads can edit the rubric." },
      { status: 403 },
    );
  }
  const parsed = rubricDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rubric." },
      { status: 400 },
    );
  }
  const ids = parsed.data.criteria.map((c) => c.id.trim().toUpperCase());
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Criterion IDs must be unique." },
      { status: 400 },
    );
  }
  const draft = await saveRubricDraft(
    {
      ...parsed.data,
      criteria: parsed.data.criteria.map((c) => ({
        ...c,
        id: c.id.trim().toUpperCase(),
      })),
    },
    session.name,
  );
  return NextResponse.json({ version: draft.version });
}
