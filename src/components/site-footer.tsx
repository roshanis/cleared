import Link from "next/link";
import { site, siteGaps } from "@/lib/site";

const linkClass =
  "touch-band text-muted underline decoration-line-strong underline-offset-2 transition-colors duration-150 hover:text-accent-strong hover:decoration-accent";

export function SiteFooter() {
  const gaps = siteGaps();
  return (
    <footer className="mt-16 border-t border-line bg-rail">
      <div className="gutter mx-auto flex w-full max-w-7xl flex-col gap-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold tracking-tight text-accent-strong">
            {site.name}
            <span className="text-accent">.</span>
          </p>
          {site.legalEntity ? (
            <p className="text-muted">{site.legalEntity}</p>
          ) : null}
          {site.postalAddress ? (
            // A real postal address, not a city name — this is the imprint.
            <address className="not-italic leading-6 text-muted">
              {site.postalAddress}
            </address>
          ) : null}
          {site.contactEmail ? (
            <p>
              <a href={`mailto:${site.contactEmail}`} className={linkClass}>
                {site.contactEmail}
              </a>
            </p>
          ) : null}
        </div>

        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
        </nav>
      </div>

      {gaps.length > 0 && (
        /* Visible in the running app, deliberately: a footer with no operator
           and no contact address is not publishable, and a silent placeholder
           is how that ships by accident. */
        <div className="gutter mx-auto w-full max-w-7xl pb-6">
          <p className="rounded-md border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-xs leading-5 text-warn">
            <span className="font-semibold">Not configured for production.</span>{" "}
            Set <span className="font-mono">{gaps.join(", ")}</span> to publish
            a real operator, contact address and governing law.
          </p>
        </div>
      )}
    </footer>
  );
}
