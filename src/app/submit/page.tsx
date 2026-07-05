import { SubmitForm } from "@/components/submit-form";
import { PageHeader } from "@/components/ui";
import { activeReviewer } from "@/agent/run";
import { requireSession } from "@/lib/session";
import { getDb, publishedRubric } from "@/lib/store";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const session = await requireSession();
  const { documentId } = await searchParams;
  const db = await getDb();
  const rubric = publishedRubric(db);

  let resubmit: { documentId: string; title: string; content: string } | null =
    null;
  if (documentId) {
    const document = db.documents.find((d) => d.id === documentId);
    const canSee =
      document &&
      (session.role !== "author" || document.author === session.name);
    if (document && canSee) {
      const latest = db.versions
        .filter((v) => v.documentId === document.id)
        .sort((a, b) => b.number - a.number)[0];
      resubmit = {
        documentId: document.id,
        title: document.title,
        content: latest?.content ?? "",
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
            : "Paste the customer-facing document below. The review takes under a minute and every finding comes with an exact quote and a fix."
        }
      />
      <SubmitForm
        resubmit={resubmit}
        reviewer={activeReviewer()}
        criteria={rubric.criteria}
      />
    </div>
  );
}
