"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "@/lib/navigation";

/* Phone navigation. A rail that scrolls sideways hides destinations behind a
   gesture nobody is prompted to make, so on small screens the whole set moves
   to a fixed bottom bar where every seat's pages are visible and thumb-high. */

const icons: Record<string, React.ReactNode> = {
  "/queue": (
    <>
      <path d="M2.5 5.5h11M2.5 9h11M2.5 12.5h6.5" />
    </>
  ),
  "/documents": (
    <>
      <path d="M3.5 2.5h5.2L12.5 6v7.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M8.6 2.6V6h3.7" />
    </>
  ),
  "/submit": (
    <>
      <path d="M8 12.8V3.4" />
      <path d="m4.6 6.8 3.4-3.4 3.4 3.4" />
      <path d="M2.8 13.5h10.4" />
    </>
  ),
  "/rubric": (
    <>
      <path d="M6 4.2h7.3M6 8h7.3M6 11.8h7.3" />
      <path d="m2.4 4.1.9.9 1.6-1.7M2.4 7.9l.9.9 1.6-1.7M2.4 11.7l.9.9 1.6-1.7" />
    </>
  ),
  "/users": (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3.2 13.6a4.8 4.8 0 0 1 9.6 0" />
    </>
  ),
  "/dashboard": (
    <>
      <path d="M3.4 13.2V8.4M6.9 13.2V4.2M10.4 13.2v-6M13.6 13.2v-9" />
    </>
  ),
  "/audit": (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.9V8l2.2 1.5" />
    </>
  ),
};

export function TabBar({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {/* The bar is fixed, so it needs a stand-in in the flow to keep the last
          of the page clear of it. It ships with the bar, which means pages
          without one (signed out) keep an ordinary bottom edge. */}
      <div
        aria-hidden
        className="h-[calc(3.25rem+env(safe-area-inset-bottom))] md:hidden"
      />
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      >
        <ul className="mx-auto flex w-full max-w-lg items-stretch">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href} className="min-w-0 flex-1">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full min-h-[3.25rem] flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-[10px] font-semibold leading-none transition-colors duration-150 ${
                    active ? "text-accent-strong" : "text-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-9 items-center justify-center rounded-full transition-colors duration-150 ${
                      active ? "bg-accent-soft" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icons[link.href]}
                    </svg>
                  </span>
                  <span className="w-full truncate text-center">
                    {link.short ?? link.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
