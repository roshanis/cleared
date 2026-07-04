"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CriterionArea,
  GoldenGateReport,
  RubricCriterion,
  Severity,
} from "@/lib/rubric";
import {
  Card,
  SectionHeading,
  StatusBadge,
  buttonClass,
  fieldLabelClass,
  inputClass,
  selectClass,
  textareaClass,
} from "./ui";

const severities: Severity[] = ["critical", "major", "minor"];
const areas: CriterionArea[] = ["content", "risk"];

interface Initial {
  criteria: RubricCriterion[];
  failOn: Severity[];
}

export function RubricEditor({
  initial,
  liveVersion,
}: {
  initial: Initial;
  liveVersion: number;
}) {
  const router = useRouter();
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initial.criteria.map((c) => ({ ...c })),
  );
  const [failOn, setFailOn] = useState<Severity[]>([...initial.failOn]);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [gate, setGate] = useState<GoldenGateReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Any edit invalidates the saved draft and its gate result.
  function touch() {
    setDraftVersion(null);
    setGate(null);
  }

  function updateCriterion(index: number, patch: Partial<RubricCriterion>) {
    touch();
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | (T & { error?: string })
      | null;
    if (!res.ok || !json) {
      throw new Error(json?.error ?? "Request failed.");
    }
    return json;
  }

  async function run(step: "save" | "gate" | "publish") {
    setBusy(step);
    setError(null);
    try {
      if (step === "save") {
        const { version } = await post<{ version: number }>("/api/rubric", {
          criteria,
          failOn,
        });
        setDraftVersion(version);
        setGate(null);
      } else if (step === "gate" && draftVersion !== null) {
        const { report } = await post<{ report: GoldenGateReport }>(
          "/api/rubric/gate",
          { version: draftVersion },
        );
        setGate(report);
      } else if (step === "publish" && draftVersion !== null) {
        await post("/api/rubric/publish", { version: draftVersion });
        setDraftVersion(null);
        setGate(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper/60 px-5 py-4">
        <div>
          <SectionHeading count={criteria.length}>Criteria</SectionHeading>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Edit the live rubric as a draft. Saving creates a new immutable
            version before the golden gate runs.
          </p>
        </div>
        <StatusBadge tone={draftVersion === null ? "neutral" : "accent"}>
          {draftVersion === null ? `Editing v${liveVersion}` : `Draft v${draftVersion}`}
        </StatusBadge>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-3">
        {criteria.map((criterion, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-lg border border-line bg-surface p-3 lg:grid-cols-[5.5rem_9rem_10rem_1fr_auto]"
          >
            <label className="block">
              <span className={`${fieldLabelClass} lg:hidden`}>ID</span>
              <input
                aria-label="Criterion ID"
                value={criterion.id}
                onChange={(e) => updateCriterion(i, { id: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="block">
              <span className={`${fieldLabelClass} lg:hidden`}>Severity</span>
              <select
                aria-label="Severity"
                value={criterion.severity}
                onChange={(e) =>
                  updateCriterion(i, { severity: e.target.value as Severity })
                }
                className={selectClass}
              >
                {severities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`${fieldLabelClass} lg:hidden`}>Reviewer</span>
              <select
                aria-label="Reviewer area"
                value={criterion.area}
                onChange={(e) =>
                  updateCriterion(i, { area: e.target.value as CriterionArea })
                }
                className={selectClass}
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a === "content" ? "policy reviewer" : "risk reviewer"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`${fieldLabelClass} lg:hidden`}>Description</span>
              <textarea
                aria-label="Criterion description"
                value={criterion.description}
                onChange={(e) =>
                  updateCriterion(i, { description: e.target.value })
                }
                rows={2}
                className={textareaClass}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                touch();
                setCriteria((prev) => prev.filter((_, idx) => idx !== i));
              }}
              className={`${buttonClass("ghost", "sm")} self-start`}
              aria-label={`Remove ${criterion.id}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            touch();
            setCriteria((prev) => [
              ...prev,
              {
                id: `C${prev.length + 1}`,
                severity: "major",
                area: "content",
                description: "",
              },
            ]);
          }}
          className={buttonClass("secondary", "sm")}
        >
          Add criterion
        </button>
      </div>

      <fieldset className="rounded-lg border border-line bg-paper/50 p-4 text-sm">
        <legend className="px-1 font-medium">Fail the document on</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {severities.map((s) => (
            <label
              key={s}
              className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2"
            >
              <input
                type="checkbox"
                checked={failOn.includes(s)}
                onChange={(e) => {
                  touch();
                  setFailOn((prev) =>
                    e.target.checked
                      ? [...prev, s]
                      : prev.filter((v) => v !== s),
                  );
                }}
              />
              {s}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          Findings below the fail threshold route to the review queue instead.
        </p>
      </fieldset>

      {gate && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            gate.pass ? "border-pass bg-pass-soft" : "border-warn bg-warn-soft"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              Golden gate ({gate.reviewer} reviewer)
            </p>
            <StatusBadge tone={gate.pass ? "pass" : "warn"}>
              {gate.cases.filter((c) => c.pass).length}/{gate.cases.length} pass
            </StatusBadge>
          </div>
          <ul className="mt-3 divide-y divide-line/60 rounded-md border border-line/60 bg-surface/70">
            {gate.cases.map((c) => (
              <li
                key={c.id}
                className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[5rem_1fr]"
              >
                <span className="font-mono font-semibold">{c.id}</span>
                <span>
                  <span
                    className={
                      c.pass ? "font-semibold text-pass" : "font-semibold text-fail"
                    }
                  >
                    {c.pass ? "Pass" : "Fail"}
                  </span>
                  <span className="text-muted">
                    {" "}
                    verdict {c.verdict} (expected {c.expectedVerdict})
                    {c.missingCriteria.length > 0 &&
                      ` missing: ${c.missingCriteria.join(",")}`}
                    {c.extraCriteria.length > 0 &&
                      ` extra: ${c.extraCriteria.join(",")}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!gate.pass && (
            <p className="mt-1 text-xs">
              Publishing is still allowed — but only do it if these regressions
              are intentional.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-fail">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("save")}
          className={buttonClass("secondary")}
        >
          {busy === "save" ? "Saving..." : "Save as draft"}
        </button>
        <button
          type="button"
          disabled={busy !== null || draftVersion === null}
          onClick={() => run("gate")}
          className={buttonClass("secondary")}
        >
          {busy === "gate" ? "Running golden set..." : "Run golden gate"}
        </button>
        <button
          type="button"
          disabled={busy !== null || draftVersion === null || gate === null}
          onClick={() => run("publish")}
          className={buttonClass("primary")}
        >
          {busy === "publish" ? "Publishing..." : `Publish draft`}
        </button>
        <span className="text-xs text-muted">
          {draftVersion !== null
            ? `Draft v${draftVersion} saved${gate ? ", gate run" : " — run the gate to enable publish"}.`
            : `Editing a copy of v${liveVersion}. Save to create a draft.`}
        </span>
      </div>
      </div>
    </Card>
  );
}
