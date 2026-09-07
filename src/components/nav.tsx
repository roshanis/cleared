import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { initials } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { linksFor } from "@/lib/navigation";
import { getSession, homeByRole } from "@/lib/session";

export async function Nav() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      {/* One row that never wraps: the link rail is the only flexible child,
          so a narrow window shrinks and scrolls it instead of pushing the
          account controls onto a second line or under the theme toggle. */}
      <div className="gutter mx-auto flex min-h-14 w-full max-w-7xl items-center gap-3 py-2">
        <Link
          href={session ? homeByRole[session.role] : "/"}
          className="touch-target flex shrink-0 items-center text-xl font-semibold tracking-tight text-accent-strong sm:text-2xl"
        >
          Cleared<span className="text-accent">.</span>
        </Link>
        {session && <NavLinks links={linksFor(session)} />}
        <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <ThemeToggle />
          {session ? (
            <>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong"
                >
                  {initials(session.name)}
                </span>
                {/* Held back until lg: at iPad-portrait widths this is what
                    would otherwise squeeze the link rail off the edge. */}
                <span className="hidden font-medium lg:inline">
                  {session.name}
                  <span className="font-normal text-muted">
                    {" "}
                    · {session.role}
                  </span>
                </span>
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="touch-target inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-muted transition-colors duration-150 hover:bg-well hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <span className="hidden text-muted lg:inline">
                Compliance review, before it ships.
              </span>
              <Link
                href="/login"
                className="touch-target inline-flex items-center whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-strong"
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
