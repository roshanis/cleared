"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReviewResult } from "@/schema";
import { ResultView } from "./result-view";
import {
  Card,
  StatusBadge,
  buttonClass,
  fieldLabelClass,
  inputClass,
  textareaClass,
} from "./ui";

type Phase = "idle" | "submitting" | "reviewing" | "done" | "error";

export function SubmitForm({
  resubmit,
  reviewer,
}: {
  resubmit: { documentId: string; title: string; content: string } | null;
  reviewer: "model" | "heuristic";
}) {
  const [title, setTitle] = useState(resubmit?.title ?? "");
  const [content, setContent] = useState(resubmit?.content ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (phase !== "reviewing") return;
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - startRef.current) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [phase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    setError(null);
    setResult(null);
    try {
      const submissionRes = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          documentId: resubmit?.documentId,
        }),
      });
      const submission = (await submissionRes.json()) as {
        error?: string;
        runId?: string;
        documentId?: string;
      };
      if (!submissionRes.ok || !submission.runId) {
        throw new Error(submission.error ?? "Submission failed.");
      }
      setDocumentId(submission.documentId ?? null);
      startRef.current = Date.now();
      setElapsed(0);
      setPhase("reviewing");

      const executeRes = await fetch(`/api/runs/${submission.runId}/execute`, {
        method: "POST",
      });
      const executed = (await executeRes.json()) as {
        error?: string;
        result?: ReviewResult;
      };
      if (!executeRes.ok || !executed.result) {
        throw new Error(executed.error ?? "The review failed — try again.");
      }
      setResult(executed.result);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  const busy = phase === "submitting" || phase === "reviewing";
  const wordCount = content.trim().length
    ? content.trim().split(/\s+/).length
    : 0;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Document draft
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {wordCount.toLocaleString()} words ready for review
              </p>
            </div>
            {reviewer === "heuristic" && (
              <StatusBadge tone="warn">Demo reviewer</StatusBadge>
            )}
          </div>

          <label className="block">
            <span className={fieldLabelClass}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy || Boolean(resubmit)}
              placeholder="Left blank? We'll use the Subject line."
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Document</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={busy}
              required
              rows={14}
              placeholder="Paste the email, page, or letter to review..."
              className={`${textareaClass} min-h-[20rem] resize-y font-serif text-[15px] leading-7`}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={busy || content.trim().length === 0}
              className={buttonClass("primary")}
            >
              {busy ? "Reviewing..." : "Submit for review"}
            </button>
            {reviewer === "heuristic" && (
              <span className="text-xs leading-5 text-muted">
                Set ANTHROPIC_API_KEY for model reviews.
              </span>
            )}
          </div>
        </form>
      </Card>

      {busy && (
        <Card className="space-y-3 border-accent/20 p-5" aria-live="polite">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Review in progress</h2>
            <span className="text-xs tabular-nums text-muted">{elapsed}s</span>
          </div>
          <ProgressStep done label="Document submitted" />
          <ProgressStep
            done={false}
            label={
              phase === "submitting"
                ? "Creating review run..."
                : "Reviewers reading your document..."
            }
          />
          <p className="pt-1 text-xs text-muted">
            Two reviewers check policy claims and data-handling risk in
            parallel, then findings are merged and the verdict is
            applied from the rubric.
          </p>
        </Card>
      )}

      {phase === "error" && (
        <Card className="border-fail bg-fail-soft p-4">
          <p role="alert" className="text-sm font-medium text-fail">
            {error}
          </p>
          <p className="mt-1 text-xs text-muted">
            Your document text is still in the form above — nothing was lost.
          </p>
        </Card>
      )}

      {phase === "done" && result && (
        <div className="space-y-3">
          <ResultView content={content} result={result} />
          <div className="flex flex-wrap gap-3 text-sm">
            {documentId && (
              <Link
                href={`/documents/${documentId}`}
                className={buttonClass("secondary", "sm")}
              >
                View document history
              </Link>
            )}
            {result.verdict !== "pass" && documentId && (
              <Link
                href={`/submit?documentId=${documentId}`}
                className={buttonClass("ghost", "sm")}
              >
                Fix and resubmit
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${
          done ? "bg-pass" : "animate-pulse-soft bg-accent"
        }`}
      />
      <span className={done ? "text-muted" : "font-medium"}>{label}</span>
    </div>
  );
}
