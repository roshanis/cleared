"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Coverage, Finding, JudgeReport } from "@/schema";
import {
  Card,
  CriterionChip,
  SeverityLabel,
  StatusBadge,
  buttonClass,
  fieldLabelClass,
  textareaClass,
} from "./ui";

type OverrideAction = "accept" | "dismiss";

export function DecisionPanel({
  runId,
  findings,
  judge,
  coverage,
}: {
  runId: string;
  findings: Finding[];
  judge?: JudgeReport;
  coverage?: Coverage[];
}) {
  const challenged = new Map(
    (judge?.challenges ?? []).map((c) => [c.findingIndex, c.reason]),
  );
  const router = useRouter();
  const [overrides, setOverrides] = useState<(OverrideAction | null)[]>(
    findings.map(() => null),
  );
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const gaps = coverage?.filter(check => ["uncertain", "unsupported", "omitted"].includes(check.status)) ?? [];
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acceptedCount = overrides.filter((action) => action === "accept").length;
  const dismissedCount = overrides.filter(action => action === "dismiss").length;
  const unreviewedCount = overrides.filter(action => action === null).length;

  async function decide(action: "approve" | "reject") {
    if (submitting || unreviewedCount > 0) return;
    if (action === "approve" && gaps.length > 0 && !acknowledged) return;
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          action,
          note,
          acknowledgedCoverageGaps: acknowledged ? gaps.map(check => check.criterionId) : [],
          overrides: overrides.map((a, findingIndex) => ({
            findingIndex,
            action: a,
          })),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Decision failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed.");
      setSubmitting(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-warn-soft px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Your decision
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-6 text-muted">
            Confirm or dismiss each finding, then record your decision.
            The note is required and goes on the audit record.
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge tone="warn">{unreviewedCount} unreviewed</StatusBadge>
          <StatusBadge tone="fail">{acceptedCount} confirmed</StatusBadge>
          <StatusBadge tone="neutral">{dismissedCount} dismissed</StatusBadge>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {gaps.length > 0 && <div className="rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm">
          <h3 className="font-semibold">Incomplete automated coverage</h3>
          <ul className="mt-2 space-y-2">{gaps.map(check => <li key={check.criterionId}><strong>{check.criterionId}</strong>: {check.detail}</li>)}</ul>
          <label className="mt-4 flex items-start gap-3 leading-6"><input type="checkbox" checked={acknowledged} disabled={submitting !== null} onChange={event => setAcknowledged(event.target.checked)} className="mt-1" />I acknowledge these coverage gaps and will explain my independent review in the decision note. This is required to approve and will be recorded in the audit trail.</label>
        </div>}
        {findings.length > 0 && <button type="button" disabled={submitting !== null} onClick={() => setOverrides(findings.map(() => "accept"))} className={buttonClass("secondary", "sm")}>Confirm all findings after review</button>}
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {findings.map((finding, i) => (
            <li
              key={i}
              className="grid gap-3 border-b border-line px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[auto_1fr_auto]"
            >
              <div className="flex items-center gap-2">
                <CriterionChip id={finding.criterionId} />
              {challenged.has(i) && (
                <span
                  title={challenged.get(i)}
                  className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn"
                >
                  judge challenged
                </span>
              )}
                <SeverityLabel severity={finding.severity} />
              </div>
              <p
                className={`min-w-0 font-serif text-sm italic leading-6 text-muted ${
                  overrides[i] === "dismiss" ? "line-through opacity-60" : ""
                }`}
              >
                "{finding.quote}"
              </p>
              <span
                role="group"
                aria-label={`Finding ${finding.criterionId}`}
                className="flex min-h-8 w-max overflow-hidden rounded-md border border-line-strong text-xs"
              >
                {(["accept", "dismiss"] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={submitting !== null}
                    onClick={() =>
                      setOverrides((prev) =>
                        prev.map((v, idx) => (idx === i ? action : v)),
                      )
                    }
                    aria-pressed={overrides[i] === action}
                    className={`px-2.5 py-1 font-medium capitalize transition-colors duration-150 ${
                      overrides[i] === action
                        ? action === "accept"
                          ? "bg-fail-soft text-fail"
                          : "bg-well text-ink"
                        : "bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {action === "accept" ? "Confirm" : "Dismiss"}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <label className="block">
          <span className={fieldLabelClass}>
            Decision note <span className="text-fail">*</span>
          </span>
          <textarea
            value={note}
            disabled={submitting !== null}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            required
            placeholder="Why you approved or rejected — the author and the auditor will both read this."
            className={textareaClass}
          />
          <span className="mt-1 block text-xs text-muted">
            {note.trim().length < 3
              ? "Add a short audit note to enable a decision."
              : `${note.trim().length} characters`}
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-fail">
            {error}
          </p>
        )}

        {unreviewedCount > 0 && <p role="status" className="text-xs text-warn">Review the {unreviewedCount} remaining finding(s) before recording a decision. No findings are accepted automatically.</p>}
        {acceptedCount > 0 && <p className="text-xs leading-5 text-muted">Approving with confirmed findings records an exception. Explain your reasoning in the decision note.</p>}
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={submitting !== null || note.trim().length < 3 || unreviewedCount > 0}
            onClick={() => decide("reject")}
            className={buttonClass("danger")}
          >
            {submitting === "reject" ? "Recording…" : "Request changes"}
          </button>
          <button
            type="button"
            disabled={submitting !== null || note.trim().length < 3 || unreviewedCount > 0 || (gaps.length > 0 && !acknowledged)}
            onClick={() => decide("approve")}
            className={buttonClass("success")}
          >
            {submitting === "approve" ? "Recording…" : "Approve with rationale"}
          </button>
        </div>
      </div>
    </Card>
  );
}
