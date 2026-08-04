"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink as NavLinkItem } from "@/lib/navigation";

/**
 * The header rail, shown from md up — below that the bottom tab bar carries
 * navigation instead. The rail is the header's only flexible child, so when a
 * seat has more pages than fit (an admin on an iPad in portrait) it scrolls
 * rather than overflowing its neighbours. Edges fade only while there is
 * genuinely more to reach, which is the affordance a bare cut-off lacks.
 */
export function NavLinks({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft > 1,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [links]);

  // Keep the page you are on in view when the rail is scrolled.
  useEffect(() => {
    rail.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const fade = `linear-gradient(to right, transparent 0, #000 ${
    edges.start ? "1.5rem" : "0px"
  }, #000 calc(100% - ${edges.end ? "1.5rem" : "0px"}), transparent 100%)`;

  return (
    <nav
      aria-label="Primary"
      ref={rail}
      className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={
        edges.start || edges.end
          ? { maskImage: fade, WebkitMaskImage: fade }
          : undefined
      }
    >
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`touch-target inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors duration-150 ${
              active
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:bg-rail hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
