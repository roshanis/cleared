import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { canManageUsers } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { getUserById, updateUser, type UserPatch } from "@/lib/store";

const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["author", "officer", "admin", "auditor"]).optional(),
  status: z.enum(["invited", "active", "deactivated"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!canManageUsers(session)) {
    return NextResponse.json(
      { error: "User management requires an admin signed in with Google." },
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

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const patch: UserPatch = { ...parsed.data };
  const roleChanged =
    parsed.data.role !== undefined && parsed.data.role !== existing.role;
  const deactivated =
    parsed.data.status === "deactivated" && existing.status !== "deactivated";
  if (roleChanged || deactivated) {
    patch.sessionGen = existing.sessionGen + 1;
  }

  const user = await updateUser(id, patch);
  return NextResponse.json({ user });
}
