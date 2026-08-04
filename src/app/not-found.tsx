import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";
import { getSession, homeByRole } from "@/lib/session";

export const metadata = { title: "Page not found" };

export default async function NotFound() {
  const session = await getSession();
  const home = session ? homeByRole[session.role] : "/";

  return (
    <Card className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="font-mono text-xs font-semibold tracking-widest text-muted">
        404
      </p>
      <h1 className="mt-3 font-serif text-3xl tracking-tight text-ink">
        That page isn&rsquo;t here
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        The link may be out of date, or the document may have been removed. Your
        work is unaffected — nothing was lost.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={home} className={buttonClass("primary")}>
          {session ? "Back to your workspace" : "Go to the home page"}
        </Link>
        {session && (
          <Link href="/documents" className={buttonClass("secondary")}>
            Browse documents
          </Link>
        )}
      </div>
    </Card>
  );
}
