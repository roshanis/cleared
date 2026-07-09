import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { initials } from "@/components/ui";
import { getSession, type Role } from "@/lib/session";

const linksByRole: Record<Role, { href: string; label: string }[]> = {
  author: [
    { href: "/submit", label: "Submit" },
    { href: "/documents", label: "My documents" },
  ],
  officer: [
    { href: "/queue", label: "Queue" },
    { href: "/documents", label: "Documents" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  admin: [
    { href: "/queue", label: "Queue" },
    { href: "/documents", label: "Documents" },
    { href: "/submit", label: "Submit" },
    { href: "/rubric", label: "Rubric" },
    { href: "/users", label: "Users" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  auditor: [
    { href: "/documents", label: "Documents" },
    { href: "/audit", label: "Audit log" },
    { href: "/dashboard", label: "Dashboard" },
  ],
};

export async function Nav() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:flex-nowrap sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-2xl font-semibold tracking-tight text-accent-strong"
        >
          Cleared<span className="text-accent">.</span>
        </Link>
        {session && <NavLinks links={linksByRole[session.role]} />}
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
          {session ? (
            <>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong"
                >
                  {initials(session.name)}
                </span>
                <span className="hidden font-medium sm:inline">
                  {session.name}
                  <span className="font-normal text-muted"> · {session.role}</span>
                </span>
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-2 py-1 text-muted transition-colors duration-150 hover:bg-well hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <span className="hidden text-muted md:inline">
                Compliance review, before it ships.
              </span>
              <Link
                href="/login"
                className="inline-flex min-h-8 items-center rounded-md bg-accent px-3 py-1.5 font-semibold text-white transition-colors duration-150 hover:bg-accent-strong"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
