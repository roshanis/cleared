import { canManageUsers } from "./roles";
import type { Role, Session } from "./session";

export interface NavLink {
  href: string;
  label: string;
  /** Used where horizontal room is scarce, such as the phone tab bar. */
  short?: string;
}

const linksByRole: Record<Role, NavLink[]> = {
  author: [
    { href: "/submit", label: "Submit" },
    { href: "/documents", label: "My documents", short: "Documents" },
  ],
  officer: [
    { href: "/queue", label: "Queue" },
    { href: "/documents", label: "Documents", short: "Docs" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  admin: [
    { href: "/queue", label: "Queue" },
    { href: "/documents", label: "Documents", short: "Docs" },
    { href: "/submit", label: "Submit" },
    { href: "/rubric", label: "Rubric" },
    { href: "/users", label: "Users" },
    { href: "/dashboard", label: "Dashboard", short: "Stats" },
  ],
  auditor: [
    { href: "/documents", label: "Documents", short: "Docs" },
    { href: "/audit", label: "Audit log", short: "Audit" },
    { href: "/dashboard", label: "Dashboard" },
  ],
};

// User management is OAuth-admin only; a demo admin would just bounce off
// the /users page, so don't offer the link to sessions that can't use it.
export function linksFor(session: Session): NavLink[] {
  return linksByRole[session.role].filter(
    (link) => link.href !== "/users" || canManageUsers(session),
  );
}
