import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { listUsers } from "@/lib/store";

export async function GET(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can manage users." },
      { status: 403 },
    );
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}
