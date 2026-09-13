import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/oauth";
import { requireSameOrigin } from "@/lib/request-guard";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  if (isGoogleOAuthConfigured()) {
    const { signOut } = await import("../../../../../auth");
    await signOut({ redirect: false });
  }
  // Land on a confirmation rather than the sign-in form: "here is the login
  // page again" does not tell you whether signing out actually worked.
  return NextResponse.redirect(
    new URL("/thank-you?for=signed-out", req.url),
    303,
  );
}
