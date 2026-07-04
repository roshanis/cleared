import { getDb, storageKind } from "./store";

const db = await getDb();
console.log(`store: ${storageKind()}`);
console.log(
  `seeded: ${db.documents.length} documents, ${db.runs.length} runs, ` +
    `${db.decisions.length} decisions, rubric v${Math.max(...db.rubrics.map((r) => r.version))}`,
);
