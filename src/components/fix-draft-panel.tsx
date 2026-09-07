"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Fix, UnlocatedFix } from "@/lib/patch";
import { Card, SectionHeading, StatusBadge, buttonClass } from "./ui";

interface FixDraft {
  documentId: string;
  title: string;
  patched: string;
  applied: Fix[];
  unlocated: UnlocatedFix[];
}

export const FIX_DRAFT_STORAGE_KEY = "cleared-fix-draft";

/** Author-initiated fix drafting: propose → preview → load into resubmit. */
export function FixDraftPanel({ runId }: { runId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<FixDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draftFixes() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/fixes`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | (FixDraft & { error?: string })
        | null;
      if (!res.ok || !body || body.error) {
        throw new Error(body?.error ?? "Drafting fixes failed.");
      }
      setDraft(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting fixes failed.");
    } finally {
      setBusy(false);
    }
  }

  function loadIntoResubmit() {
    if (!draft) return;
    try {
    sessionStorage.setItem(
      FIX_DRAFT_STORAGE_KEY,
      JSON.stringify({
        documentId: draft.documentId,
        title: draft.title,
        content: draft.patched,
      }),
    );
    router.push(`/submit?documentId=${draft.documentId}&fixDraft=1`);
    } catch {
      setError("Your browser could not transfer this draft. Copy the proposed text below into the revision form.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-rail px-5 py-4">
        <div>
          <SectionHeading>Fix draft</SectionHeading>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            The fixer proposes edits for the reported findings.
            Nothing is submitted — you review, edit, and resubmit.
          </p>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={draftFixes}
            disabled={busy}
            className={buttonClass("primary")}
          >
            {busy ? "Drafting…" : "Draft fixes"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="px-5 py-4 text-sm font-medium text-fail">
          {error}
        </p>
      )}

      {draft && (
        <div className="space-y-4 p-5">
          <details className="rounded-lg border border-line p-4 text-sm"><summary className="cursor-pointer font-medium">Read the complete proposed draft</summary><pre className="mt-3 whitespace-pre-wrap break-words font-serif leading-7">{draft.patched}</pre></details>
          <ul className="space-y-3">
            {draft.applied.map((fix, i) => (
              <li key={i} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={fix.kind === "insert" ? "info" : "accent"}>
                    {fix.kind === "insert" ? "Added" : "Rewritten"}
                  </StatusBadge>
                  <span className="text-xs text-muted">{fix.note}</span>
                </div>
                {fix.kind === "replace" && (
                  <p className="mt-2 font-serif text-sm italic leading-6 text-muted line-through decoration-fail/40">
                    “{fix.quote}”
                  </p>
                )}
                <p className="mt-1.5 font-serif text-sm leading-6">
                  “{fix.replacement}”
                </p>
              </li>
            ))}
          </ul>

          {draft.unlocated.length > 0 && (
            <div className="rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-sm leading-6">
              <p className="font-medium text-warn">
                {draft.unlocated.length} passage
                {draft.unlocated.length === 1 ? "" : "s"} couldn&apos;t be
                located — apply those fixes manually:
              </p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {draft.unlocated.map((miss, i) => (
                  <li key={i}>“{miss.quote}”</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={loadIntoResubmit}
              className={buttonClass("primary")}
            >
              Load into resubmit
            </button>
            <span className="text-xs text-muted">
              Opens the submit form with the patched document — review before
              submitting.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
