"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReviewProgress } from "./review-progress";
import { buttonClass } from "./ui";

export function RerunPanel({ runId, documentId, userId, status, canRerun }: {
  runId: string; documentId: string; userId: string;
  status: "queued" | "reviewing" | "done" | "error"; canRerun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [watch, setWatch] = useState(0);
  const start = useRef(Date.now());
  const inFlight = status === "reviewing";
  const key = useRef<string | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    if (!busy && !inFlight) return;
    start.current = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start.current), 1000);
    return () => clearInterval(timer);
  }, [busy, inFlight]);

  useEffect(() => {
    if (!inFlight) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setError(null);
    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? "Unable to check this review.");
        if (body.status === "done" || body.status === "error") { router.refresh(); return; }
        if (Date.now() - start.current > 310_000) {
          setError("The review is taking longer than expected. Its result is not confirmed. Check again to recover the latest status.");
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Connection interrupted. Check the review status again.");
      }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [runId, inFlight, router, watch]);

  async function run() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(null); setElapsed(0);
    const retry = status === "error" || status === "queued";
    const storageKey = `cleared:rerun:${userId}:${runId}`;
    try {
      if (!retry && !key.current) {
        try { key.current = sessionStorage.getItem(storageKey); } catch { /* storage can be unavailable */ }
        key.current ??= crypto.randomUUID();
        try { sessionStorage.setItem(storageKey, key.current); } catch { /* keep in-memory retry key */ }
      }
      const res = await fetch(`/api/runs/${runId}/${retry ? "execute" : "rerun"}`, {
        method: "POST", headers: retry ? {} : { "Idempotency-Key": key.current! },
        signal: AbortSignal.timeout(310_000),
      });
      const body = await res.json();
      if (body.runId) {
        try { sessionStorage.removeItem(storageKey); } catch { /* optional recovery storage */ }
        router.push(`/documents/${documentId}?run=${body.runId}`);
        router.refresh();
      }
      if (!res.ok && !(res.status === 409 && body.status === "reviewing")) throw new Error(body.error ?? "The review could not complete.");
      if (retry) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection interrupted. Retry with the same request to recover your review.");
    } finally { setBusy(false); locked.current = false; }
  }

  if (busy || (inFlight && !error)) return <ReviewProgress elapsedMs={elapsed} />;
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-rail/60 p-4">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{status === "error" ? "Review needs recovery" : status === "queued" ? "Document saved · review not started" : inFlight ? "Review status unconfirmed" : "Need another review?"}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{status === "done" ? "A new run uses the current published rubric. This review and its decision remain in history." : "Recover this saved review without creating another document version."}</p>
      {error && <p role="alert" className="mt-2 text-sm text-fail">{error}</p>}
    </div>
    {inFlight ? <button type="button" onClick={() => { start.current = Date.now(); setWatch(v => v + 1); }} className={buttonClass("secondary", "sm")}>Check status again</button> :
      canRerun ? <button type="button" onClick={run} className={buttonClass("secondary", "sm")}>{status === "done" ? "Re-run review" : "Resume review"}</button> :
      <Link href="/documents" className={buttonClass("secondary", "sm")}>Back to documents</Link>}
  </div>;
}
