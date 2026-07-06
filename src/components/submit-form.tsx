"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sampleDocument } from "@/lib/copy";
import { FIX_DRAFT_STORAGE_KEY } from "./fix-draft-panel";
import { SUPPORTED_JURISDICTIONS } from "@/lib/rubric";
import type { RubricCriterion } from "@/lib/rubric";
import type { ReviewResult } from "@/schema";
import { ResultView } from "./result-view";
import {
  Card,
  HowItWorksStep,
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
  criteria,
  fixDraftRequested = false,
}: {
  resubmit: { documentId: string; title: string; content: string } | null;
  reviewer: "model" | "heuristic";
  /** Published rubric criteria, used to explain finding IDs in the result. */
  criteria?: RubricCriterion[];
  /** True when arriving from a fix draft — prefill from sessionStorage. */
  fixDraftRequested?: boolean;
}) {
  const [title, setTitle] = useState(resubmit?.title ?? "");
  const [markets, setMarkets] = useState<string[]>(["US"]);
  const [content, setContent] = useState(resubmit?.content ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [fixDraftLoaded, setFixDraftLoaded] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!fixDraftRequested) return;
    const raw = sessionStorage.getItem(FIX_DRAFT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FIX_DRAFT_STORAGE_KEY);
    try {
      const draft = JSON.parse(raw) as { content?: string };
      if (draft.content) {
        setContent(draft.content);
        setFixDraftLoaded(true);
      }
    } catch {
      // Malformed draft — fall back to the regular resubmit prefill.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixDraftRequested]);

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
          jurisdictions: markets,
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
  const showIntro = !resubmit && phase === "idle" && content.trim().length === 0;

  function loadSample() {
    setTitle(sampleDocument.title);
    setContent(sampleDocument.content);
  }

  return (
    <div className="space-y-6">
      {showIntro && (
        <Card className="grid gap-4 p-5 sm:grid-cols-3 sm:gap-6">
          <HowItWorksStep
            step={1}
            title="Submit"
            detail="Paste any customer-facing text — an email, a page, a letter."
          />
          <HowItWorksStep
            step={2}
            title="AI review"
            detail="Two reviewers check it against your compliance rubric and quote every problem."
          />
          <HowItWorksStep
            step={3}
            title="Human decision"
            detail="Anything flagged goes to a compliance officer; you fix and resubmit."
          />
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="grid gap-4 border-b border-line bg-rail px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Review packet
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Paste the source document exactly as the customer would see it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={wordCount > 0 ? "accent" : "neutral"}>
              {wordCount.toLocaleString()} words
            </StatusBadge>
            <StatusBadge tone={reviewer === "heuristic" ? "warn" : "accent"}>
              {reviewer === "heuristic" ? "Demo reviewer" : "Model reviewers"}
            </StatusBadge>
            {fixDraftLoaded && (
              <StatusBadge tone="info">
                Fix draft loaded — review before submitting
              </StatusBadge>
            )}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
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

          <fieldset>
            <legend className={fieldLabelClass}>Target markets</legend>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_JURISDICTIONS.map((market) => {
                const active = markets.includes(market);
                return (
                  <button
                    key={market}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() =>
                      setMarkets((prev) => {
                        const next = active
                          ? prev.filter((m) => m !== market)
                          : [...prev, market];
                        return next.length === 0 ? prev : next;
                      })
                    }
                    className={`inline-flex min-h-8 items-center rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-line-strong bg-surface text-muted hover:border-accent hover:text-ink"
                    }`}
                  >
                    {market}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              The rubric applies market-specific rules per selection — you get
              a verdict for each market.
            </p>
          </fieldset>

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

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button
              type="submit"
              disabled={busy || content.trim().length === 0}
              className={buttonClass("primary")}
            >
              {busy ? "Reviewing..." : "Submit for review"}
            </button>
            {showIntro && (
              <button
                type="button"
                onClick={loadSample}
                className={buttonClass("secondary")}
              >
                Try a sample document
              </button>
            )}
            <span className="text-xs leading-5 text-muted">
              {reviewer === "heuristic"
                ? "Set OPENAI_API_KEY for model reviews."
                : "Model reviewers will check policy and data-handling risk."}
            </span>
          </div>
        </form>
      </Card>

      {busy && (
        <Card className="space-y-4 border-accent/25 bg-accent-soft/45 p-5" aria-live="polite">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Review in progress</h2>
            <span className="text-xs tabular-nums text-muted">{elapsed}s</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ProgressStep done label="Document submitted" />
            <ProgressStep
              done={phase === "reviewing"}
              active={phase === "submitting"}
              label="Review run created"
            />
            <ProgressStep
              done={false}
              active={phase === "reviewing"}
              label="Reviewers reading"
            />
          </div>
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
          <ResultView content={content} result={result} criteria={criteria} />
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

function ProgressStep({
  done,
  active = false,
  label,
}: {
  done: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${
          done ? "bg-pass" : active ? "animate-pulse-soft bg-accent" : "bg-line-strong"
        }`}
      />
      <span className={done ? "text-muted" : active ? "font-medium" : "text-muted"}>
        {label}
      </span>
    </div>
  );
}
