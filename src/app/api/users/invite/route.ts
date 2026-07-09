import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { canManageUsers } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { inviteUser } from "@/lib/store";

const bodySchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["author", "officer", "admin", "auditor"]),
});

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!canManageUsers(session)) {
    return NextResponse.json(
      { error: "Inviting users requires an admin signed in with Google." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const result = await inviteUser(parsed.data);
  if (result.status === "conflict") {
    return NextResponse.json(
      { error: "A user with that email already exists.", user: result.user },
      { status: 409 },
    );
  }
  return NextResponse.json({ user: result.user });
}
