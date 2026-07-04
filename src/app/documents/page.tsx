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
      return { document, latestVersion, run, decision };
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
          <Link href="/submit" className={buttonClass("primary")}>
            Submit a document
          </Link>
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          hint="Submit your first customer-facing document and get a verdict with exact quotes and fixes in under a minute."
          action={
            <Link href="/submit" className={buttonClass("primary")}>
              Submit a document
            </Link>
          }
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-rail">
              <tr>
                <Th>Document</Th>
                <Th>Author</Th>
                <Th>Version</Th>
                <Th>Agent verdict</Th>
                <Th>Decision</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.map(({ document, latestVersion, run, decision }) => (
                <tr
                  key={document.id}
                  className="transition-colors duration-150 hover:bg-rail/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-accent-strong hover:underline"
                    >
                      {document.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{document.author}</td>
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
