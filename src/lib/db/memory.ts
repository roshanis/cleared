import type { Db, Decision, DocVersion, DocumentRecord, ReviewRun } from "@/lib/store";
import type { RubricVersion } from "@/lib/rubric";
import {
  createSerialQueue,
  UniqueViolationError,
  type StoreDriver,
  type Tx,
} from "./driver";

const clone = <T>(value: T): T => structuredClone(value);

/**
 * In-process driver: tests and store-less deploys (Vercel without a
 * database). Transactions are serialized on a promise queue; rollback
 * restores a structuredClone taken before the callback ran.
 */
export function createMemoryDriver(): StoreDriver {
  let state: Db = {
    documents: [],
    versions: [],
    runs: [],
    decisions: [],
    rubrics: [],
  };
  const enqueue = createSerialQueue();

  const tx: Tx = {
    async getDocument(id: string): Promise<DocumentRecord | null> {
      return clone(state.documents.find((d) => d.id === id) ?? null);
    },

    async nextVersionNumber(documentId: string): Promise<number> {
      const numbers = state.versions
        .filter((v) => v.documentId === documentId)
        .map((v) => v.number);
      return Math.max(0, ...numbers) + 1;
    },

    async getVersion(id: string): Promise<DocVersion | null> {
      return clone(state.versions.find((v) => v.id === id) ?? null);
    },

    async getRun(id: string): Promise<ReviewRun | null> {
      return clone(state.runs.find((r) => r.id === id) ?? null);
    },

    async getRubric(version: number): Promise<RubricVersion | null> {
      return clone(state.rubrics.find((r) => r.version === version) ?? null);
    },

    async latestPublishedRubric(): Promise<RubricVersion | null> {
      const published = state.rubrics
        .filter((r) => r.publishedAt !== null)
        .sort((a, b) => b.version - a.version);
      return clone(published[0] ?? null);
    },

    async maxRubricVersion(): Promise<number> {
      return Math.max(0, ...state.rubrics.map((r) => r.version));
    },

    async getDecisionByRunId(runId: string): Promise<Decision | null> {
      return clone(state.decisions.find((d) => d.runId === runId) ?? null);
    },

    async insertDocument(document: DocumentRecord): Promise<void> {
      if (state.documents.some((d) => d.id === document.id)) {
        throw new UniqueViolationError(`documents.id = ${document.id}`);
      }
      state.documents.push(clone(document));
    },

    async insertVersion(version: DocVersion): Promise<void> {
      if (state.versions.some((v) => v.id === version.id)) {
        throw new UniqueViolationError(`versions.id = ${version.id}`);
      }
      if (
        state.versions.some(
          (v) =>
            v.documentId === version.documentId && v.number === version.number,
        )
      ) {
        throw new UniqueViolationError(
          `versions(document_id, number) = (${version.documentId}, ${version.number})`,
        );
      }
      state.versions.push(clone(version));
    },

    async insertRun(run: ReviewRun): Promise<void> {
      if (state.runs.some((r) => r.id === run.id)) {
        throw new UniqueViolationError(`runs.id = ${run.id}`);
      }
      state.runs.push(clone(run));
    },

    async claimRun(id: string): Promise<ReviewRun | null> {
      const run = state.runs.find((r) => r.id === id);
      if (!run || (run.status !== "queued" && run.status !== "error")) {
        return null;
      }
      run.status = "reviewing";
      run.error = null;
      return clone(run);
    },

    async updateRun(id, patch): Promise<ReviewRun | null> {
      const run = state.runs.find((r) => r.id === id);
      if (!run) return null;
      Object.assign(run, clone(patch));
      return clone(run);
    },

    async insertDecision(decision: Decision): Promise<void> {
      if (state.decisions.some((d) => d.id === decision.id)) {
        throw new UniqueViolationError(`decisions.id = ${decision.id}`);
      }
      if (state.decisions.some((d) => d.runId === decision.runId)) {
        throw new UniqueViolationError(`decisions.run_id = ${decision.runId}`);
      }
      state.decisions.push(clone(decision));
    },

    async insertRubric(rubric: RubricVersion): Promise<void> {
      if (state.rubrics.some((r) => r.version === rubric.version)) {
        throw new UniqueViolationError(`rubrics.version = ${rubric.version}`);
      }
      state.rubrics.push(clone(rubric));
    },

    async updateRubric(version, patch): Promise<RubricVersion | null> {
      const rubric = state.rubrics.find((r) => r.version === version);
      if (!rubric) return null;
      if (patch.goldenGate !== undefined) rubric.goldenGate = clone(patch.goldenGate);
      if (patch.publishedAt !== undefined) rubric.publishedAt = patch.publishedAt;
      return clone(rubric);
    },
  };

  return {
    kind: "memory",

    async init() {},

    snapshot(): Promise<Db> {
      return enqueue(async () => clone(state));
    },

    transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return enqueue(async () => {
        const backup = clone(state);
        try {
          return await fn(tx);
        } catch (error) {
          state = backup;
          throw error;
        }
      });
    },
  };
}
