import { RubricEditor } from "@/components/rubric-editor";
import { PageHeader, StatusBadge, TableCard, Th } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { getDb, publishedRubric } from "@/lib/store";

export default async function RubricPage() {
  await requireRole("admin");
  const db = await getDb();
  const current = publishedRubric(db);
  const versions = db.rubrics.slice().sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Rubric"
        subtitle={`Version ${current.version} is live. Edits become a new draft version; the golden-set gate must run before you can publish.`}
      />

      <RubricEditor
        initial={{ criteria: current.criteria, failOn: current.failOn }}
        liveVersion={current.version}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Version history
        </h2>
        <TableCard>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-well">
              <tr>
                <Th>Version</Th>
                <Th>Author</Th>
                <Th>Created</Th>
                <Th>Golden gate</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {versions.map((rubric) => (
                <tr
                  key={rubric.version}
                  className="transition-colors duration-150 hover:bg-paper"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    v{rubric.version}
                  </td>
                  <td className="px-4 py-3 text-muted">{rubric.author}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(rubric.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {rubric.goldenGate ? (
                      <StatusBadge
                        tone={rubric.goldenGate.pass ? "pass" : "fail"}
                      >
                        {rubric.goldenGate.cases.filter((c) => c.pass).length}/
                        {rubric.goldenGate.cases.length} cases pass
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-muted">not run</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rubric.publishedAt ? (
                      <StatusBadge
                        tone={
                          rubric.version === current.version ? "accent" : "neutral"
                        }
                      >
                        {rubric.version === current.version
                          ? "Live"
                          : "Superseded"}
                      </StatusBadge>
                    ) : (
                      <StatusBadge>Draft</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </section>
    </div>
  );
}
