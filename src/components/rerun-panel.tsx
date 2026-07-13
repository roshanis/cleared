"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReviewProgress } from "./review-progress";
import { theaterDone } from "./review-theater";
import { Card, buttonClass } from "./ui";

type RunStatus = "queued" | "reviewing" | "done" | "error";
type Phase = "idle" | "reviewing" | "error";
type WatchKind = "none" | "auto" | "manual";

export function RerunPanel({
  runId,
  status,
  canRerun,
}: {
  runId: string;
  status: RunStatus;
  canRerun: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [watchKind, setWatchKind] = useState<WatchKind>("none");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const startRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    if (phase !== "reviewing") return;
    const timer = setInterval(
      () => setElapsedMs(Date.now() - startRef.current),
      200,
    );
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (status !== "queued" && status !== "reviewing") return;
    let cancelled = false;

    startRef.current = Date.now();
    setElapsedMs(0);
    setError(null);
    setPendingRefresh(false);
    setWatchKind("auto");
    setPhase("reviewing");

    let poller: ReturnType<typeof setInterval>;
    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`, {
          credentials: "same-origin",
        });
        const body = await readJson(res);
        if (cancelled || !mountedRef.current) return;
        if (!res.ok) {
          setError(apiErrorMessage(asString(body.error)));
          setWatchKind("none");
          setPhase("error");
          return;
        }
        if (body.status === "done" || body.status === "error") {
          clearInterval(poller);
          setError(asString(body.error) ?? null);
          setPendingRefresh(true);
        }
      } catch {
        if (cancelled || !mountedRef.current) return;
        setError("The review status could not be loaded. Try again.");
        setWatchKind("none");
        setPhase("error");
      }
    }

    poller = setInterval(poll, 2000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(poller);
    };
  }, [runId, status]);

  useEffect(() => {
    if (status !== "done" && status !== "error") return;
    if (watchKind !== "auto") return;
    setPhase("idle");
    setWatchKind("none");
    setPendingRefresh(false);
  }, [status, watchKind]);

  useEffect(() => {
    if (phase !== "reviewing" || !pendingRefresh) return;
    if (!theaterDone(elapsedMs, reducedMotion)) return;
    setPendingRefresh(false);
    router.refresh();
  }, [elapsedMs, pendingRefresh, phase, reducedMotion, router]);

  async function startRerun() {
    setPhase("reviewing");
    setWatchKind("manual");
    setError(null);
    setPendingRefresh(false);
    startRef.current = Date.now();
    setElapsedMs(0);

    try {
      const res = await fetch(`/api/runs/${runId}/rerun`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await readJson(res);
      if (!mountedRef.current) return;
      if (!res.ok) {
        setError(
          apiErrorMessage(
            asString(body.error),
            asNumber(body.retryAfterSeconds),
          ),
        );
        setWatchKind("none");
        setPhase("error");
        return;
      }
      if (body.status === "done") {
        setPendingRefresh(true);
        return;
      }
      setError("The review did not finish. Try again.");
      setWatchKind("none");
      setPhase("error");
    } catch {
      if (!mountedRef.current) return;
      setError("The review could not be started. Try again.");
      setWatchKind("none");
      setPhase("error");
    }
  }

  if (!canRerun) return null;

  if (phase === "reviewing" || status === "queued" || status === "reviewing") {
    return (
      <ReviewProgress elapsedMs={elapsedMs} reducedMotion={reducedMotion} />
    );
  }

  if (phase === "error") {
    return (
      <Card className="grid gap-3 border-fail/40 bg-fail-soft p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p role="alert" className="text-sm font-semibold text-fail">
            {error ?? "The review failed. Try again."}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Run the agents again on this version when you are ready.
          </p>
        </div>
        <button
          type="button"
          onClick={startRerun}
          className={buttonClass("secondary", "sm")}
        >
          Re-run review
        </button>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="grid gap-3 border-fail/40 bg-fail-soft p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-semibold text-fail">The review failed.</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Run the agents again on this version to retry.
          </p>
        </div>
        <button
          type="button"
          onClick={startRerun}
          className={buttonClass("secondary", "sm")}
        >
          Re-run review
        </button>
      </Card>
    );
  }

  return (
    <Card className="grid gap-3 border-accent/20 bg-rail p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-sm font-semibold">Review complete</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Run the agents again on this version — picks up the latest published
          rubric.
        </p>
      </div>
      <button
        type="button"
        onClick={startRerun}
        className={buttonClass("secondary", "sm")}
      >
        Re-run review
      </button>
    </Card>
  );
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const json = await res.json();
    return typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function apiErrorMessage(error?: string, retryAfterSeconds?: number) {
  if (!error) return "Submission failed.";
  if (!retryAfterSeconds || error.includes("Wait")) return error;
  if (retryAfterSeconds < 60) {
    return `${error} Retry in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`;
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${error} Retry in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
