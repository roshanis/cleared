/**
 * Analytics is off unless a deployment configures it, and the only supported
 * shape is a self-describing script URL — no vendor is baked in and no
 * account of ours is assumed.
 *
 * `NEXT_PUBLIC_ANALYTICS_SRC`  the script to load (e.g. a Plausible or Umami
 *                              endpoint, or a first-party proxy)
 * `NEXT_PUBLIC_ANALYTICS_ID`   the site/domain identifier that script wants
 * `NEXT_PUBLIC_ANALYTICS_USES_COOKIES`  set to "1" ONLY for a provider that
 *                              stores cookies or other non-essential state on
 *                              the device. That is what gates the consent
 *                              banner — see CookieNotice.
 */

export interface AnalyticsConfig {
  src: string;
  id: string | null;
  usesCookies: boolean;
}

export function analyticsConfig(): AnalyticsConfig | null {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC?.trim();
  if (!src) return null;
  // Only https, and never a javascript:/data: URL smuggled through env.
  if (!/^https:\/\//i.test(src)) return null;
  return {
    src,
    id: process.env.NEXT_PUBLIC_ANALYTICS_ID?.trim() || null,
    usesCookies: process.env.NEXT_PUBLIC_ANALYTICS_USES_COOKIES?.trim() === "1",
  };
}
