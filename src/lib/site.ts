/**
 * Single source for the facts that appear in metadata, the sitemap, the
 * footer, and the legal pages.
 *
 * Everything a real deployment must own — the public URL, the operating legal
 * entity, a contact address — is read from the environment and has NO usable
 * default. `siteGaps()` reports what is still unset so the footer and the
 * legal pages can say "not configured" instead of quietly shipping a
 * plausible-looking lie about who runs the service and how to reach them.
 */

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const site = {
  name: "Cleared",
  tagline: "Compliance review, before it ships.",
  description:
    "Fast feedback for writers. Full authority for compliance. A complete trail for auditors.",

  /** Public origin. Used for metadataBase, robots and the sitemap. */
  url:
    env("NEXT_PUBLIC_SITE_URL") ??
    (env("VERCEL_PROJECT_PRODUCTION_URL")
      ? `https://${env("VERCEL_PROJECT_PRODUCTION_URL")}`
      : "http://localhost:3000"),

  /** The legal entity that operates the service. */
  legalEntity: env("NEXT_PUBLIC_LEGAL_ENTITY"),
  /** Registered postal address, as it must appear on a real imprint. */
  postalAddress: env("NEXT_PUBLIC_CONTACT_ADDRESS"),
  contactEmail: env("NEXT_PUBLIC_CONTACT_EMAIL"),
  privacyEmail: env("NEXT_PUBLIC_PRIVACY_EMAIL") ?? env("NEXT_PUBLIC_CONTACT_EMAIL"),
  /** Governing law for the terms, e.g. "England and Wales". */
  jurisdiction: env("NEXT_PUBLIC_LEGAL_JURISDICTION"),
} as const;

/** True when the deployment has a real public origin, not the dev fallback. */
export function hasPublicUrl(): boolean {
  return !site.url.startsWith("http://localhost");
}

/**
 * What a production deployment still has to supply. Rendered in the footer and
 * on the legal pages so an unconfigured deployment is visibly unfinished
 * rather than silently wrong.
 */
export function siteGaps(): string[] {
  const gaps: string[] = [];
  if (!hasPublicUrl()) gaps.push("NEXT_PUBLIC_SITE_URL");
  if (!site.legalEntity) gaps.push("NEXT_PUBLIC_LEGAL_ENTITY");
  if (!site.postalAddress) gaps.push("NEXT_PUBLIC_CONTACT_ADDRESS");
  if (!site.contactEmail) gaps.push("NEXT_PUBLIC_CONTACT_EMAIL");
  if (!site.jurisdiction) gaps.push("NEXT_PUBLIC_LEGAL_JURISDICTION");
  return gaps;
}

/** Whether the review pipeline sends document text to a third-party model. */
export function usesThirdPartyModel(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
