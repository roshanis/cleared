import { SubmitForm } from "@/components/submit-form";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { activeReviewer } from "@/agent/run";
import { requireRole } from "@/lib/session";
import { getDb, publishedRubric, latestRunForVersion } from "@/lib/store";
import { maxDocumentChars } from "@/lib/submission-limits";
import { SUPPORTED_JURISDICTIONS, type Jurisdiction } from "@/lib/rubric";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string; fixDraft?: string }>;
}) {
  const session = await requireRole("author", "admin");
  const { documentId, fixDraft } = await searchParams;
  const db = await getDb();
  const rubric = publishedRubric(db);

  let resubmit: { documentId: string; title: string; content: string; markets: Jurisdiction[] } | null =
    null;
  if (documentId) {
    const document = db.documents.find((d) => d.id === documentId);
    const canSee =
      document &&
      (session.role !== "author" || document.author === session.name);
    if (!document || !canSee) notFound();
    if (document && canSee) {
      const latest = db.versions
        .filter((v) => v.documentId === document.id)
        .sort((a, b) => b.number - a.number)[0];
      resubmit = {
        documentId: document.id,
        title: document.title,
        content: latest?.content ?? "",
        markets: (latest ? latestRunForVersion(db, latest.id)?.jurisdictions ?? ["US"] : ["US"]).filter((m): m is Jurisdiction => SUPPORTED_JURISDICTIONS.includes(m as Jurisdiction)),
      };
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={resubmit ? `Resubmit: ${resubmit.title}` : "Submit a document"}
        subtitle={
          resubmit
            ? "Apply the fixes and submit a new version — you'll see what changed against the last review."
            : "Review investment communications against your team's rules, with evidence and clear next steps."
        }
      />
      <SubmitForm
        key={documentId ?? "new"}
        userId={session.userId}
        rubricVersion={rubric.version}
        maxChars={maxDocumentChars()}
        resubmit={resubmit}
        reviewer={activeReviewer()}
        criteria={rubric.criteria}
        fixDraftRequested={fixDraft === "1"}
      />
    </div>
  );
}
