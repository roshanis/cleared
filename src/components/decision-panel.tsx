"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Finding } from "@/schema";
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
}: {
  runId: string;
  findings: Finding[];
}) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<OverrideAction[]>(
    findings.map(() => "accept"),
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acceptedCount = overrides.filter((action) => action === "accept").length;
  const dismissedCount = overrides.length - acceptedCount;

  async function decide(action: "approve" | "reject") {
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-warn-soft/60 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Your decision
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-6 text-muted">
            Accept or dismiss each finding, then approve or reject the document.
            The note is required and goes on the audit record.
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge tone="fail">{acceptedCount} accepted</StatusBadge>
          <StatusBadge tone="neutral">{dismissedCount} dismissed</StatusBadge>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <ul className="space-y-2">
          {findings.map((finding, i) => (
            <li
              key={i}
              className="grid gap-3 rounded-lg border border-line bg-surface px-3 py-3 text-sm sm:grid-cols-[auto_1fr_auto]"
            >
              <div className="flex items-center gap-2">
                <CriterionChip id={finding.criterionId} />
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
                className="flex w-max overflow-hidden rounded-md border border-line-strong text-xs"
              >
                {(["accept", "dismiss"] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
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
                    {action}
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

        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={submitting !== null || note.trim().length < 3}
            onClick={() => decide("reject")}
            className={buttonClass("danger")}
          >
            {submitting === "reject" ? "Recording…" : "Reject document"}
          </button>
          <button
            type="button"
            disabled={submitting !== null || note.trim().length < 3}
            onClick={() => decide("approve")}
            className={buttonClass("success")}
          >
            {submitting === "approve" ? "Recording…" : "Approve anyway"}
          </button>
        </div>
      </div>
    </Card>
  );
}
