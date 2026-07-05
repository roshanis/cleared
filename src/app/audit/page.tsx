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
import { requireRole } from "@/lib/session";
import { decisionForRun, getDb } from "@/lib/store";

interface SearchParams {
  action?: string;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("officer", "admin", "auditor");
  const db = await getDb();
  const { action: filterAction } = await searchParams;

  // Build decision log: newest first
  const decisions = db.decisions
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((d) => {
      if (filterAction === "approve") return d.action === "approve";
      if (filterAction === "reject") return d.action === "reject";
      return true;
    })
    .map((decision) => {
      const run = db.runs.find((r) => r.id === decision.runId) ?? null;
      const document = run
        ? db.documents.find((doc) => doc.id === run.documentId) ?? null
        : null;
      return { decision, run, document };
    });

  const filterLinks: { label: string; value: string | undefined }[] = [
    { label: "All", value: undefined },
    { label: "Approved", value: "approve" },
    { label: "Rejected", value: "reject" },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every decision is recorded with the officer, note, rubric version, and review result."
        action={
          <a href="/api/export" className={buttonClass("secondary")}>
            Export audit CSV
          </a>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {filterLinks.map(({ label, value }) => {
          const isActive = filterAction === value || (!filterAction && !value);
          const href = value ? `/audit?action=${value}` : "/audit";
          return (
            <Link
              key={label}
              href={href}
              className={
                isActive
                  ? buttonClass("primary", "sm")
                  : buttonClass("secondary", "sm")
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {decisions.length === 0 ? (
        <EmptyState
          title="No decisions yet"
          hint="Decisions appear here once a compliance officer approves or rejects a document review."
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-rail">
              <tr>
                <Th>Document</Th>
                <Th>Officer</Th>
                <Th>Action</Th>
                <Th>Note</Th>
                <Th>Rubric</Th>
                <Th>Agent verdict</Th>
                <Th>Decided</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {decisions.map(({ decision, run, document }) => (
                <tr
                  key={decision.id}
                  className="transition-colors duration-150 hover:bg-rail/60"
                >
                  <td className="px-4 py-3">
                    {document ? (
                      <Link
                        href={`/documents/${document.id}`}
                        className="font-medium text-accent-strong hover:underline"
                      >
                        {document.title}
                      </Link>
                    ) : (
                      <span className="text-muted">{decision.documentId}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{decision.officer}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={decision.action === "approve" ? "pass" : "fail"}
                    >
                      {decision.action === "approve" ? "Approved" : "Rejected"}
                    </StatusBadge>
                  </td>
                  <td
                    className="max-w-xs px-4 py-3 text-muted"
                    title={decision.note}
                  >
                    <span className="line-clamp-2">{decision.note || "—"}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {run ? `v${run.rubricVersion}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {run?.result ? (
                      <VerdictBadge verdict={run.result.verdict} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {relativeTime(decision.createdAt)}
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
