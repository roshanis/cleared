"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sampleDocument } from "@/lib/copy";
import { draftKey, readDraft, saveDraft, type SavedDraft } from "@/lib/draft";
import { SUPPORTED_JURISDICTIONS, type Jurisdiction, type RubricCriterion } from "@/lib/rubric";
import type { ReviewResult } from "@/schema";
import { FIX_DRAFT_STORAGE_KEY } from "./fix-draft-panel";
import { ReviewProgress } from "./review-progress";
import { ResultView } from "./result-view";
import { Card, StatusBadge, buttonClass, fieldLabelClass, inputClass, textareaClass } from "./ui";

type Phase = "idle" | "saving" | "reviewing" | "done" | "error";
export function SubmitForm({ resubmit, reviewer, criteria = [], fixDraftRequested = false, userId, rubricVersion, maxChars }: {
  resubmit: { documentId: string; title: string; content: string; markets: Jurisdiction[] } | null;
  reviewer: "model" | "heuristic"; criteria?: RubricCriterion[]; fixDraftRequested?: boolean;
  userId: string; rubricVersion: number; maxChars: number;
}) {
  const [title, setTitle] = useState(resubmit?.title ?? "");
  const [content, setContent] = useState(resubmit?.content ?? "");
  const [markets, setMarkets] = useState<Jurisdiction[]>(resubmit?.markets ?? ["US"]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [actualReviewer, setActualReviewer] = useState(reviewer);
  const [elapsed, setElapsed] = useState(0);
  const [remember, setRemember] = useState(true);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<SavedDraft | null>(null);
  const [storageMessage, setStorageMessage] = useState("Draft recovery uses this tab only.");
  const requestKey = useRef("");
  const locked = useRef(false);
  const started = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const storageKey = draftKey(userId, resubmit?.documentId);
  const busy = phase === "saving" || phase === "reviewing";
  const applicable = criteria.filter(c => !c.jurisdictions || c.jurisdictions.some(m => markets.includes(m as Jurisdiction)));

  useEffect(() => {
    requestKey.current = crypto.randomUUID();
    try {
      const saved = readDraft(sessionStorage, storageKey);
      if (saved) setRecovery(saved);
      if (fixDraftRequested) {
        const raw = sessionStorage.getItem(FIX_DRAFT_STORAGE_KEY);
        const draft = raw ? JSON.parse(raw) : null;
        if (draft?.content && draft.documentId === resubmit?.documentId) {
          setContent(draft.content); setRecovery(null);
          sessionStorage.removeItem(FIX_DRAFT_STORAGE_KEY);
        }
      }
    } catch { setStorageMessage("Tab storage is unavailable. Keep this page open to preserve your draft."); }
    setReady(true);
    return () => controller.current?.abort();
  }, [storageKey, fixDraftRequested, resubmit?.documentId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed(Date.now() - started.current), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!ready || recovery || phase === "done" || !remember || !content.trim()) return;
    const timer = setTimeout(() => {
      try {
        const saved = saveDraft(sessionStorage, storageKey, { title, content, markets, requestKey: requestKey.current, runId, documentId, savedAt: Date.now() });
        setStorageMessage(saved ? "Draft saved in this tab · expires after 8 hours." : "Draft could not be saved. Keep this tab open or copy your text.");
      } catch { setStorageMessage("Draft could not be saved. Keep this tab open or copy your text."); }
    }, 300);
    return () => clearTimeout(timer);
  }, [title, content, markets, runId, documentId, ready, recovery, phase, remember, storageKey]);

  function edited() {
    requestKey.current = crypto.randomUUID();
    setRunId(null); setDocumentId(null); setResult(null); setError(null); setPhase("idle");
  }
  function restore() {
    if (!recovery) return;
    setTitle(recovery.title); setContent(recovery.content); setMarkets(recovery.markets);
    requestKey.current = recovery.requestKey;
    setRunId(recovery.runId); setDocumentId(recovery.documentId);
    setRecovery(null);
  }
  function discardRecovery() {
    try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
    setRecovery(null);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current || !content.trim() || markets.length === 0 || content.length > maxChars || recovery) return;
    locked.current = true; started.current = Date.now(); setElapsed(0); setError(null); setResult(null);
    controller.current = new AbortController();
    const abortTimer = setTimeout(() => controller.current?.abort(), 310_000);
    const signal = controller.current.signal;
    let targetRun = runId;
    let targetDoc = documentId;
    try {
      if (!targetRun) {
        setPhase("saving");
        requestKey.current ||= crypto.randomUUID();
        if (remember) {
          try { saveDraft(sessionStorage, storageKey, { title, content, markets, requestKey: requestKey.current, runId: null, documentId: null, savedAt: Date.now() }); } catch { /* optional storage */ }
        }
        const res = await fetch("/api/submissions", {
          method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current }, signal,
          body: JSON.stringify({ title, content, documentId: resubmit?.documentId, jurisdictions: markets }),
        });
        const body = await res.json();
        if (!res.ok || !body.runId) throw new Error(body.error ?? "Unable to save the document. Retry to recover the same request.");
        targetRun = body.runId; targetDoc = body.documentId;
        setRunId(targetRun); setDocumentId(targetDoc); setActualReviewer(body.reviewer ?? reviewer);
        if (remember) {
          try { saveDraft(sessionStorage, storageKey, { title, content, markets, requestKey: requestKey.current, runId: targetRun, documentId: targetDoc, savedAt: Date.now() }); } catch { /* optional storage */ }
        }
      }
      setPhase("reviewing");
      let res = await fetch(`/api/runs/${targetRun}/execute`, { method: "POST", signal });
      let body = await res.json();
      if (!res.ok && !(res.status === 409 && body.status === "reviewing")) throw new Error(body.error ?? "Review interrupted. Resume this saved review.");
      while (body.status === "reviewing" || body.status === "queued") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        res = await fetch(`/api/runs/${targetRun}`, { signal });
        body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Unable to check the review status.");
      }
      if (!body.result || body.status === "error") throw new Error(body.error ?? "No completed result is available. Resume the saved review.");
      setResult(body.result); setPhase("done"); setStorageMessage("Review saved. The temporary draft has been cleared from this tab.");
      try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (e) {
      if (signal.aborted) setError("The connection ended before a result was confirmed. Your request can be safely retried.");
      else setError(e instanceof Error ? e.message : "Connection interrupted. Retry to recover the same request.");
      setPhase("error");
    } finally { clearTimeout(abortTimer); locked.current = false; }
  }

  return <div className="space-y-6">
    {recovery && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/25 bg-accent-soft p-4">
      <div><p className="text-sm font-semibold">A draft is available in this tab</p><p className="mt-1 text-xs text-muted">{recovery.title || "Untitled draft"} · {recovery.markets.join(" / ")}</p></div>
      <div className="flex gap-2"><button type="button" onClick={restore} className={buttonClass("primary", "sm")}>Restore draft</button><button type="button" onClick={discardRecovery} className={buttonClass("secondary", "sm")}>Discard saved draft</button></div>
    </div>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-rail px-5 py-4">
          <h2 className="font-semibold">{resubmit ? "Revise your document" : "Your draft"}</h2>
          <StatusBadge tone={actualReviewer === "model" ? "accent" : "warn"}>{actualReviewer === "model" ? "Model review" : "Demo review"}</StatusBadge>
        </div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <label className="block"><span className={fieldLabelClass}>Document title</span>
            <input className={inputClass} value={title} maxLength={200} disabled={busy || !!resubmit || !!recovery} onChange={e => { edited(); setTitle(e.target.value); }} placeholder="e.g. September investor newsletter" />
          </label>
          <fieldset disabled={busy || !!recovery}>
            <legend className={fieldLabelClass}>Target markets</legend>
            <p className="mb-3 text-xs leading-5 text-muted">{resubmit ? "Carried forward from the previous review. Changing a market changes which rules apply." : "Select where this communication will be used."}</p>
            <div className="flex flex-wrap gap-2">{SUPPORTED_JURISDICTIONS.map(market => <label key={market} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm ${markets.includes(market) ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="checkbox" checked={markets.includes(market)} onChange={e => { edited(); setMarkets(prev => e.target.checked ? [...prev, market] : prev.filter(m => m !== market)); }} />{market}
            </label>)}</div>
            {markets.length === 0 && <p role="alert" className="mt-2 text-xs text-fail">Select at least one market.</p>}
          </fieldset>
          <label className="block"><span className={fieldLabelClass}>Customer-facing text</span>
            <textarea className={`${textareaClass} min-h-80 font-serif text-base`} value={content} disabled={busy || !!recovery} required rows={13} aria-describedby="document-limit" onChange={e => { edited(); setContent(e.target.value); }} placeholder="Paste the complete communication, including disclosures and references." />
          </label>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <p id="document-limit" className={content.length > maxChars ? "text-fail" : "text-muted"}>{content.length.toLocaleString()} / {maxChars.toLocaleString()} characters</p>
            {!resubmit && <button type="button" disabled={busy || !!content.trim() || !!recovery} onClick={() => { edited(); setTitle(sampleDocument.title); setContent(sampleDocument.content); }} className="font-medium text-accent-strong underline disabled:opacity-40">Use a synthetic sample</button>}
          </div>
          <div className="border-t border-line pt-4">
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={remember} disabled={busy} onChange={e => { setRemember(e.target.checked); if (!e.target.checked) { try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ } setStorageMessage("Draft recovery is off. Keep this tab open."); } }} />Remember this draft in this browser tab for up to 8 hours</label>
            <p className="mt-2 text-xs leading-5 text-muted" role="status">{storageMessage}</p>
          </div>
          {error && <div role="alert" className="rounded-lg bg-fail-soft p-4 text-sm leading-6 text-fail">{error}{runId && documentId && <Link className="mt-2 block font-semibold underline" href={`/documents/${documentId}?run=${runId}`}>Open saved review</Link>}</div>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!ready || busy || !!recovery || !content.trim() || !markets.length || content.length > maxChars || phase === "done"} className={buttonClass("primary")}>{phase === "done" ? "Review complete" : busy ? "Review in progress…" : runId ? "Resume saved review" : resubmit ? "Submit revised version" : "Review document"}</button>
            <span className="text-xs text-muted">You keep the final editorial decision.</span>
          </div>
        </form>
      </Card>
      <aside className="space-y-5 lg:sticky lg:top-24">
        <div className="border-l-2 border-accent pl-4">
          <p className="text-xs font-semibold tracking-wide text-accent-strong">REVIEW SCOPE</p>
          <h2 className="mt-2 text-lg font-semibold">Know what is being checked.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Rubric v{rubricVersion} · {applicable.length} selected rules. A review flags possible issues; it does not verify external facts or grant approval.</p>
        </div>
        <details className="rounded-lg border border-line bg-surface p-4" open>
          <summary className="cursor-pointer text-sm font-semibold">Rules for {markets.join(" / ") || "your markets"}</summary>
          <ul className="mt-3 space-y-3">{applicable.map(c => <li key={c.id} className="border-t border-line pt-3 text-xs leading-5 text-muted"><span className="mr-2 font-mono font-semibold text-accent-strong">{c.id}</span>{c.description}</li>)}</ul>
        </details>
        {reviewer === "heuristic" && <p className="rounded-lg bg-warn-soft p-4 text-xs leading-5 text-warn">Demo mode uses limited pattern checks. Custom rules and uncovered language need a model or human review. Coverage gaps are shown with the result.</p>}
      </aside>
    </div>
    {busy && <ReviewProgress elapsedMs={elapsed} submitting={phase === "saving"} />}
    {result && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 ref={resultHeading} tabIndex={-1} className="text-xl font-semibold">Your review is ready</h2><Link href={`/documents/${documentId}?run=${runId}`} className={buttonClass("primary")}>Open review workspace →</Link></div><ResultView content={content} result={result} criteria={criteria} /></section>}
  </div>;
}
