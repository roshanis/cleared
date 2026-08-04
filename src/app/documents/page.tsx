import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  TableCard,
  Th,
  TimeAgo,
  VerdictBadge,
  buttonClass,
} from "@/components/ui";
import { canAccessDocument } from "@/lib/access";
import { requireSession } from "@/lib/session";
import { decisionForRun, getDb, latestRunForVersion } from "@/lib/store";
import { documentStatus, type DocumentStatusKind } from "@/lib/document-status";

const statusFilters: {
  value: string | undefined;
  label: string;
  matches: (status: DocumentStatusKind) => boolean;
}[] = [
  { value: undefined, label: "All", matches: () => true },
  {
    value: "action_needed",
    label: "Awaiting fix",
    matches: (status) => status === "action_needed",
  },
  {
    value: "in_review",
    label: "In review",
    matches: (status) => status === "in_review",
  },
  { value: "passed", label: "Passed", matches: (status) => status === "clear" },
  {
    value: "approved",
    label: "Approved",
    matches: (status) => status === "approved",
  },
  {
    value: "rejected",
    label: "Rejected",
    matches: (status) => status === "rejected",
  },
];

function StatusCell({
  status,
  documentId,
}: {
  status: DocumentStatusKind;
  documentId: string;
}) {
  if (status === "action_needed")
    return <StatusBadge tone="warn">Action needed</StatusBadge>;
  if (status === "in_review")
    return <StatusBadge tone="info">In review</StatusBadge>;
  if (status === "rejected")
    return (
      <Link href={`/submit?documentId=${documentId}`} className="inline-flex">
        <StatusBadge tone="fail">Rejected — fix &amp; resubmit</StatusBadge>
      </Link>
    );
  return null;
}

export const metadata = { title: "Documents" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status: statusParam } = await searchParams;
  const db = await getDb();

  const allDocuments = db.documents
    .filter((d) => canAccessDocument(session, d))
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

  const activeFilter =
    statusFilters.find((f) => f.value === statusParam) ?? statusFilters[0];
  const documents = allDocuments.filter(({ status }) =>
    activeFilter.matches(status),
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

      {allDocuments.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {statusFilters.map((filter) => {
            const count = allDocuments.filter(({ status }) =>
              filter.matches(status),
            ).length;
            if (filter.value !== undefined && count === 0) return null;
            const isActive = filter.value === activeFilter.value;
            const href = filter.value
              ? `/documents?status=${filter.value}`
              : "/documents";
            return (
              <Link
                key={filter.label}
                href={href}
                aria-current={isActive ? "true" : undefined}
                className={`touch-target inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                  isActive
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line-strong bg-surface text-muted hover:border-accent hover:text-ink"
                }`}
              >
                {filter.label}
                <span
                  className={`tabular-nums ${isActive ? "" : "text-subtle"}`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {allDocuments.length > 0 && documents.length === 0 ? (
        <EmptyState
          title={`No documents are ${activeFilter.label.toLowerCase()}`}
          hint="Clear the filter to see the rest of the list."
          action={
            <Link href="/documents" className={buttonClass("secondary")}>
              Show all documents
            </Link>
          }
        />
      ) : documents.length === 0 ? (
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
        <>
        {/* Small screens: one card per document, so status and verdict stay
            visible instead of scrolling off an 820px-wide table. */}
        <ul className="space-y-3 md:hidden">
          {documents.map(({ document, latestVersion, run, decision, status }) => (
            <li key={document.id}>
              <Link
                href={`/documents/${document.id}`}
                className="block rounded-lg border border-line bg-surface p-4 shadow-card transition-colors duration-150 hover:border-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {run?.result ? (
                    <VerdictBadge verdict={run.result.verdict} />
                  ) : (
                    <span className="text-xs text-muted">
                      {run ? run.status : "no review"}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {latestVersion ? <TimeAgo iso={latestVersion.createdAt} /> : "—"}
                  </span>
                </div>
                <p className="mt-2.5 font-medium text-accent-strong">
                  {document.title}
                  <span className="ml-2 text-xs font-normal tabular-nums text-muted">
                    v{latestVersion?.number ?? "—"}
                  </span>
                </p>
                {!isAuthor && (
                  <p className="mt-0.5 text-xs text-muted">
                    by {document.author}
                  </p>
                )}
                {(isAuthor || decision) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {isAuthor && (
                      <StatusCell status={status} documentId={document.id} />
                    )}
                    {decision && (
                      <StatusBadge
                        tone={decision.action === "approve" ? "pass" : "fail"}
                      >
                        {decision.action === "approve" ? "Approved" : "Rejected"}
                        <span className="font-normal text-muted">
                          by {decision.officer}
                        </span>
                      </StatusBadge>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <TableCard className="hidden md:block">
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
                      <StatusCell status={status} documentId={document.id} />
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
                    {latestVersion ? (
                      <TimeAgo iso={latestVersion.createdAt} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
        </>
      )}
    </div>
  );
}
