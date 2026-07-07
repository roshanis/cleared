"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "./ui";

export function ResetDemoDataButton() {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setError(null);
    if (!armed) {
      setArmed(true);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Demo reset failed.");
        setArmed(false);
        return;
      }
      setArmed(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className={buttonClass("danger", "sm")}
        onClick={reset}
        disabled={isPending}
      >
        {isPending
          ? "Resetting..."
          : armed
            ? "Really reset? This wipes all demo data"
            : "Reset demo data"}
      </button>
      {error && (
        <p className="text-xs leading-5 text-fail" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
