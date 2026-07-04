import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { publishRubric } from "@/lib/store";

const bodySchema = z.object({ version: z.number().int() });

export async function POST(req: Request) {
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
  const published = await publishRubric(parsed.data.version);
  if (!published) {
    return NextResponse.json(
      { error: "Run the golden-set gate before publishing." },
      { status: 409 },
    );
  }
  return NextResponse.json({ version: published.version });
}
