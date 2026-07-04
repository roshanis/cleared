import { redirect } from "next/navigation";
import { LoginCards } from "@/components/login-cards";
import { getSession, personas } from "@/lib/session";

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

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");
  const needsAccessCode = Boolean(process.env.APP_ACCESS_CODE);
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 py-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-12">
      <section className="rounded-2xl bg-accent-strong p-8 text-white shadow-raised sm:p-10">
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Compliance review,
          <br />
          before it ships.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
          Cleared reviews customer-facing documents against your compliance
          rubric. An AI reviewer finds the problems; your team makes the calls.
        </p>
        <ul className="mt-8 space-y-5">
          {valueProps.map((prop) => (
            <li key={prop.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13.5 4.5 6.4 11.6 2.5 7.7" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold">{prop.title}</span>
                <span className="mt-0.5 block text-sm leading-6 text-white/70">
                  {prop.detail}
                </span>
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
        <div className="mt-5">
          <LoginCards
            personas={personas.map(({ id, name, role, tagline }) => ({
              id,
              name,
              role,
              tagline,
            }))}
            needsAccessCode={needsAccessCode}
          />
        </div>
        <p className="mt-6 text-xs leading-5 text-muted">
          Demo authentication. Swap in your identity provider before real use —
          the role model underneath stays the same.
        </p>
      </section>
    </div>
  );
}
