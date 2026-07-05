import Link from "next/link";
import {
  CriterionChip,
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
import { getDb, reviewQueue } from "@/lib/store";

export default async function QueuePage() {
  await requireRole("officer", "admin");
  const db = await getDb();
  const queue = reviewQueue(db);

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle="Everything the agent failed or flagged for human judgment, oldest first. Your decision is final."
        action={
          <StatusBadge tone={queue.length === 0 ? "pass" : "warn"}>
            {queue.length} waiting
          </StatusBadge>
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          title="The queue is clear"
          hint="Nothing is waiting on a decision. New submissions that fail or need human review will appear here."
          action={
            <Link href="/dashboard" className={buttonClass("secondary")}>
              View dashboard
            </Link>
          }
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-rail">
              <tr>
                <Th>Waiting</Th>
                <Th>Document</Th>
                <Th>Author</Th>
                <Th>Agent verdict</Th>
                <Th>Findings</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.map(({ run, document, version }) => (
                <tr
                  key={run.id}
                  className="transition-colors duration-150 hover:bg-rail/60"
                >
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-warn">
                    {relativeTime(run.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-accent-strong hover:underline"
                    >
                      {document.title}
                    </Link>
                    <span className="ml-2 text-xs tabular-nums text-muted">
                      v{version.number}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{document.author}</td>
                  <td className="px-4 py-3">
                    {run.result && <VerdictBadge verdict={run.result.verdict} />}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {run.result?.findings.length
                        ? run.result.findings.map((f, i) => (
                            <CriterionChip key={i} id={f.criterionId} />
                          ))
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/documents/${document.id}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      Review
                    </Link>
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
