import { redirect } from "next/navigation";
import { LoginCards } from "@/components/login-cards";
import { buttonClass } from "@/components/ui";
import { publicDemoEnabled } from "@/lib/demo";
import {
  isGoogleOAuthConfigured,
  loginAuthOptions,
  oauthLoginErrorMessage,
} from "@/lib/oauth";
import { demoAuthEnabled, getSession, personas, homeByRole } from "@/lib/session";

const valueProps = [
  {
    title: "Evidence and context",
    detail:
      "Inspect quoted claims, missing-language checks, and proposed edits beside the original text.",
  },
  {
    title: "Humans stay in charge",
    detail:
      "Failed or uncertain documents route to your compliance team; every decision carries a note.",
  },
  {
    title: "Decisions stay traceable",
    detail:
      "Inspect every review run, its rubric, the officer's rationale, and the audit export.",
  },
];

async function signInWithGoogle() {
  "use server";
  const { signIn } = await import("../../../auth");
  await signIn("google", { redirectTo: "/login" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; error?: string; oauth?: string }>;
}) {
  const { as: highlightPersona, error, oauth } = await searchParams;
  const session = await getSession();
  if (session) redirect(homeByRole[session.role]);
  const isPublicDemo = publicDemoEnabled();
  const needsAccessCode = Boolean(process.env.APP_ACCESS_CODE) && !isPublicDemo;
  const canUseDemoAuth = demoAuthEnabled();
  const authState = loginAuthOptions({
    demoAuthEnabled: canUseDemoAuth,
    oauthConfigured: isGoogleOAuthConfigured(),
  });
  const oauthMessage = oauthLoginErrorMessage(oauth ?? error);
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-8 py-6 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:py-12">
      <section className="rounded-lg bg-accent-strong p-8 text-white shadow-raised sm:p-10">
        <p className="mb-5 inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          {canUseDemoAuth ? "Persona demo" : "Your team’s workspace"}
        </p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          {canUseDemoAuth ? "Choose a seat." : "Welcome to Cleared."}
          <br />
          <em className="text-white/80">{canUseDemoAuth ? "See the whole system." : "Pick up your next review."}</em>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
          {canUseDemoAuth ? "Each persona has different access. Explore the author, officer, lead, and auditor workflows." : "Sign in with your invited account to access your team's documents, reviews, and decisions."}
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
        <h2 className="text-lg font-semibold tracking-tight">{canUseDemoAuth ? "Sign in as" : "Sign in"}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {canUseDemoAuth ? "Pick a persona to explore that customer’s experience." : "Use the email address your workspace administrator invited."}
        </p>
        {oauthMessage && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-fail/25 bg-fail-soft p-4 text-sm leading-6 text-fail"
          >
            {oauthMessage}
          </div>
        )}
        {authState.showGoogle && (
          <form action={signInWithGoogle} className="mt-5">
            <button type="submit" className={buttonClass("secondary")}>
              Sign in with Google
            </button>
          </form>
        )}
        {authState.showGoogle && authState.showDemoPersonas && (
          <div className="my-5 border-t border-line" />
        )}
        {authState.showDemoPersonas ? (
          <div className="mt-5">
            <LoginCards
              personas={personas.map(({ id, name, role, tagline, sees }) => ({
                id,
                name,
                role,
                tagline,
                sees,
                home: homeByRole[role],
              }))}
              needsAccessCode={needsAccessCode}
              highlight={highlightPersona}
            />
          </div>
        ) : authState.state === "oauth_not_configured" ? (
          <div className="mt-5 rounded-lg border border-line bg-rail p-5 text-sm leading-6 text-muted">
            {authState.state === "oauth_not_configured"
              ? authState.message
              : "Demo persona sign-in is disabled for this environment."}
          </div>
        ) : null}
        <p className="mt-6 text-xs leading-5 text-muted">
          {isPublicDemo
            ? "This is a shared public demo — anything you submit is visible to other visitors and may reset at any time."
            : canUseDemoAuth ? "Use synthetic documents to explore the demo. Model coverage and customer policies must be validated before real use." : "Access is invitation-only. Contact your workspace administrator if you cannot sign in."}
        </p>
      </section>
    </div>
  );
}
