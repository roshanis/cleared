import { demoAuthEnabled, getSession, personas, type Role } from "@/lib/session";
import { DemoBanner } from "./demo-banner";

/** One thing worth trying per seat — shown in the demo banner. */
const hintByRole: Record<Role, { href: string; text: string }> = {
  author: {
    href: "/submit",
    text: "Submit the sample document and watch it fail with exact quotes — then draft fixes and resubmit.",
  },
  officer: {
    href: "/queue",
    text: "Open the queue and decide a flagged review — every override needs a note.",
  },
  admin: {
    href: "/rubric",
    text: "Edit the rubric, run the golden gate, and publish a new version.",
  },
  auditor: {
    href: "/audit",
    text: "Read the decision trail and export the audit CSV.",
  },
};

export async function DemoStrip() {
  if (!demoAuthEnabled()) return null;
  const session = await getSession();
  if (!session) return null;
  return (
    <DemoBanner
      current={{
        id: session.personaId,
        name: session.name,
        role: session.role,
      }}
      others={personas
        .filter((p) => p.id !== session.personaId)
        .map(({ id, name, role }) => ({ id, name, role }))}
      hint={hintByRole[session.role]}
    />
  );
}
