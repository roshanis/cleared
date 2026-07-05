import type { Role } from "./session";

/** Only compliance officers and admins may record decisions. */
export function canDecide(role: Role): boolean {
  return role === "officer" || role === "admin";
}

/** Only document authors and admins may submit content for review. */
export function canSubmit(role: Role): boolean {
  return role === "author" || role === "admin";
}

/** Everyone except authors may export the audit CSV. */
export function canExport(role: Role): boolean {
  return role !== "author";
}

/** Only compliance leads (admin) may create or publish rubric versions. */
export function canEditRubric(role: Role): boolean {
  return role === "admin";
}

/** Only officers and admins may access the review queue. */
export function canViewQueue(role: Role): boolean {
  return role === "officer" || role === "admin";
}

/** Officers, admins, and auditors may view the dashboard. */
export function canViewDashboard(role: Role): boolean {
  return role === "officer" || role === "admin" || role === "auditor";
}
