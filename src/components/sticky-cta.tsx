"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Keeps the primary action reachable on a phone once the hero has scrolled
 * away — and only then. A sticky bar duplicating a button that is already on
 * screen just eats the viewport, so this watches the hero CTA and appears when
 * it leaves.
 *
 * Rendered for signed-out visitors only: signed in, the bottom of the screen
 * belongs to the tab bar.
 */
export function StickyCta({
  href,
  label,
  watch,
}: {
  href: string;
  label: string;
  /** id of the element whose visibility decides whether this shows. */
  watch: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { rootMargin: "0px 0px -8px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  if (!show) return null;

  return (
    <>
      {/* Holds space so the bar never covers the end of the page. */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <div className="safe-bottom gutter fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="flex items-center gap-3 py-3">
          <p className="min-w-0 flex-1 text-xs leading-5 text-muted">
            A verdict in under a minute, with the exact quote.
          </p>
          <Link
            href={href}
            className="touch-target inline-flex shrink-0 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {label}
          </Link>
        </div>
      </div>
    </>
  );
}
