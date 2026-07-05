import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  TableCard,
  Th,
  VerdictBadge,
  buttonClass,
  relativeTime,
} from "@/components/ui";
import { requireSession } from "@/lib/session";
import { decisionForRun, getDb, latestRunForVersion } from "@/lib/store";
import { documentStatus } from "@/lib/document-status";

export default async function DocumentsPage() {
  const session = await requireSession();
  const db = await getDb();

  const documents = db.documents
    .filter((d) => session.role !== "author" || d.author === session.name)
    .map((document) => {
      const versions = db.versions
        .filter((v) => v.documentId === document.id)
        .sort((a, b) => b.number - a.number);
      const latestVersion = versions[0];
      const run = latestVersion
        ? latestRunForVersion(db, latestVersion.id)
        : null;
      const decision = run ? decisionForRun(db, run.id) : null;
      const status = documentStatus({
        verdict: run?.result?.verdict ?? null,
        hasDecision: decision !== null,
        decisionAction: decision?.action ?? null,
      });
      return { document, latestVersion, run, decision, status };
    })
    .sort((a, b) =>
      (b.latestVersion?.createdAt ?? "").localeCompare(
        a.latestVersion?.createdAt ?? "",
      ),
    );

  const isAuthor = session.role === "author";

  return (
    <div>
      <PageHeader
        title={isAuthor ? "My documents" : "Documents"}
        subtitle={
          isAuthor
            ? "Everything you've submitted, with the latest verdict on each."
            : "All submitted documents across the team."
        }
        action={
          isAuthor ? (
            <Link href="/submit" className={buttonClass("primary")}>
              Submit a document
            </Link>
          ) : undefined
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          hint={
            isAuthor
              ? "Submit your first customer-facing document and get a verdict with exact quotes and fixes in under a minute. You can also load the sample from the submit page."
              : "No documents have been submitted yet."
          }
          action={
            isAuthor ? (
              <Link href="/submit" className={buttonClass("primary")}>
                Submit a document
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-rail">
              <tr>
                {isAuthor && <Th>Status</Th>}
                <Th>Document</Th>
                {!isAuthor && <Th>Author</Th>}
                <Th>Version</Th>
                <Th>Agent verdict</Th>
                <Th>Decision</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.map(({ document, latestVersion, run, decision, status }) => (
                <tr
                  key={document.id}
                  className="transition-colors duration-150 hover:bg-rail/60"
                >
                  {isAuthor && (
                    <td className="px-4 py-3">
                      {status === "action_needed" ? (
                        <StatusBadge tone="warn">Action needed</StatusBadge>
                      ) : status === "in_review" ? (
                        <StatusBadge tone="info">In review</StatusBadge>
                      ) : status === "rejected" ? (
                        <Link
                          href={`/submit?documentId=${document.id}`}
                          className="inline-flex"
                        >
                          <StatusBadge tone="fail">
                            Rejected — fix &amp; resubmit
                          </StatusBadge>
                        </Link>
                      ) : null}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-accent-strong hover:underline"
                    >
                      {document.title}
                    </Link>
                  </td>
                  {!isAuthor && (
                    <td className="px-4 py-3 text-muted">{document.author}</td>
                  )}
                  <td className="px-4 py-3 tabular-nums text-muted">
                    v{latestVersion?.number ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {run?.result ? (
                      <VerdictBadge verdict={run.result.verdict} />
                    ) : (
                      <span className="text-xs text-muted">
                        {run ? run.status : "no review"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {decision ? (
                      <StatusBadge
                        tone={decision.action === "approve" ? "pass" : "fail"}
                      >
                        {decision.action === "approve" ? "Approved" : "Rejected"}
                        <span className="font-normal text-muted">
                          by {decision.officer}
                        </span>
                      </StatusBadge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {latestVersion ? relativeTime(latestVersion.createdAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
