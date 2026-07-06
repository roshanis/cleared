import { redirect } from "next/navigation";
import { LoginCards } from "@/components/login-cards";
import { demoAuthEnabled, getSession, personas } from "@/lib/session";

const valueProps = [
  {
    title: "Exact quotes, real fixes",
    detail:
      "Every finding cites the offending passage and says how to fix it — no vague scores.",
  },
  {
    title: "Humans stay in charge",
    detail:
      "Failed or uncertain documents route to your compliance team; every decision carries a note.",
  },
  {
    title: "Audit-ready by default",
    detail:
      "Versioned rubric, immutable review history, one-click CSV export for the auditor.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as: highlightPersona } = await searchParams;
  const session = await getSession();
  if (session) redirect("/");
  const needsAccessCode = Boolean(process.env.APP_ACCESS_CODE);
  const canUseDemoAuth = demoAuthEnabled();
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-8 py-6 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:py-12">
      <section className="rounded-lg bg-accent-strong p-8 text-white shadow-raised sm:p-10">
        <p className="mb-5 inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Persona demo
        </p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Choose a seat.
          <br />
          <em className="text-white/80">See the whole system.</em>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
          Each persona has different access — author, officer, admin, and
          auditor all see different screens, queues, and actions.
        </p>
        <ul className="mt-8 divide-y divide-white/14 border-y border-white/14">
          {valueProps.map((prop) => (
            <li key={prop.title} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]">
              <span
                className="block text-sm font-semibold text-white"
              >
                {prop.title}
              </span>
              <span className="block text-sm leading-6 text-white/70">
                {prop.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lg:pt-2">
        <h2 className="text-lg font-semibold tracking-tight">Sign in as</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Pick a persona to explore that customer&apos;s experience.
        </p>
        {canUseDemoAuth ? (
          <div className="mt-5">
            <LoginCards
              personas={personas.map(({ id, name, role, tagline, sees }) => ({
                id,
                name,
                role,
                tagline,
                sees,
              }))}
              needsAccessCode={needsAccessCode}
              highlight={highlightPersona}
            />
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-line bg-rail p-5 text-sm leading-6 text-muted">
            Demo persona sign-in is disabled for this environment.
          </div>
        )}
        <p className="mt-6 text-xs leading-5 text-muted">
          Demo authentication is enabled by default only outside production.
          Swap in your identity provider before real use; the role model
          underneath stays the same.
        </p>
      </section>
    </div>
  );
}
