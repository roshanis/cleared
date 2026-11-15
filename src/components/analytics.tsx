"use client";

import { useEffect, useState } from "react";
import type { AnalyticsConfig } from "@/lib/analytics";
import { buttonClass } from "./ui";

const CONSENT_KEY = "cleared-analytics-consent";
type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Private mode, blocked storage. Treat as undecided and never load.
    return null;
  }
}

/**
 * Analytics plus its consent gate.
 *
 * A banner is shown ONLY when the configured provider actually stores
 * something on the device. Asking permission for a strictly necessary session
 * cookie is not required and teaches people to dismiss consent prompts
 * without reading them, so a cookieless provider loads with no banner and a
 * cookie-setting one loads nothing at all until someone accepts.
 */
export function Analytics({ config }: { config: AnalyticsConfig }) {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  const decide = (choice: Exclude<Consent, null>) => {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Not persisted; the banner returns next visit. Honour it for this one.
    }
    setConsent(choice);
  };

  // Nothing renders until the stored decision has been read, so a script is
  // never loaded for one paint before consent is known.
  if (!ready) return null;

  const allowed = config.usesCookies ? consent === "granted" : true;

  return (
    <>
      {allowed && (
        <script
          async
          src={config.src}
          {...(config.id ? { "data-domain": config.id } : {})}
        />
      )}
      {config.usesCookies && consent === null && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-notice-title"
          /* Above the phone tab bar, and inside the safe area on a notched
             iPhone — a banner under the home indicator cannot be dismissed. */
          className="safe-bottom gutter fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface shadow-raised md:bottom-0"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p id="cookie-notice-title" className="text-sm font-semibold">
                Analytics cookies
              </p>
              <p className="mt-0.5 text-sm leading-6 text-muted">
                We&rsquo;d like to measure which pages get used. Nothing is
                loaded unless you accept. The cookie that keeps you signed in
                is separate and always on — it has to be.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide("denied")}
                className={buttonClass("secondary", "sm")}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => decide("granted")}
                className={buttonClass("primary", "sm")}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
