"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Horizontal scroll container for the wide tables.
 *
 * A scrollable box that only a mouse or a swipe can reach is a dead end for
 * keyboard users, so this takes a tab stop — but ONLY while it actually
 * overflows. Most of these tables fit at desktop widths, and an unconditional
 * tab stop would put a focusable, landmark-announced box that does nothing in
 * front of every table on the page.
 */
export function ScrollRegion({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScrollable(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // The table itself changes width when rows change, not just the viewport.
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      // Only a scrollable region is worth naming and stopping on.
      {...(scrollable
        ? { role: "region" as const, "aria-label": label, tabIndex: 0 }
        : {})}
      className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </div>
  );
}
