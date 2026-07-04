"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-0.5 text-sm sm:order-none sm:w-auto sm:overflow-visible sm:pb-0"
    >
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 font-medium transition-colors duration-150 ${
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
