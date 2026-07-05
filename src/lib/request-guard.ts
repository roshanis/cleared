import { NextResponse } from "next/server";

const trustedFetchSites = new Set(["same-origin", "same-site", "none"]);

export function requireSameOrigin(req: Request): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !trustedFetchSites.has(fetchSite)) {
    return NextResponse.json(
      { error: "Cross-site requests are not allowed." },
      { status: 403 },
    );
  }

  const origin = req.headers.get("origin");
  if (!origin) return null;

  try {
    if (new URL(origin).origin === new URL(req.url).origin) return null;
  } catch {
    // Fall through to the generic rejection below.
  }

  return NextResponse.json(
    { error: "Cross-origin requests are not allowed." },
    { status: 403 },
  );
}
