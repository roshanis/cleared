"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { initials, inputClass } from "./ui";

interface PersonaCard {
  id: string;
  name: string;
  role: string;
  tagline: string;
  sees: string;
}

export function LoginCards({
  personas,
  needsAccessCode,
}: {
  personas: PersonaCard[];
  needsAccessCode: boolean;
}) {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(personaId: string) {
    setPending(personaId);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, accessCode }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Sign-in failed.");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {needsAccessCode && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Access code</span>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className={`${inputClass} max-w-xs`}
            placeholder="Shared access code"
          />
        </label>
      )}
      <div className="grid gap-2.5">
        {personas.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => signIn(persona.id)}
            disabled={pending !== null}
            className="group flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-lg border border-line bg-surface p-4 text-left shadow-card transition-colors duration-150 hover:border-accent hover:bg-accent-soft/35 disabled:pointer-events-none disabled:opacity-60"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-sm font-semibold text-accent-strong"
            >
              {initials(persona.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium">{persona.name}</span>
                <span className="rounded-md bg-well px-2 py-0.5 text-[11px] font-medium text-muted">
                  {persona.role}
                </span>
              </span>
              <span className="mt-0.5 block text-sm leading-5 text-muted">
                {pending === persona.id ? "Signing in…" : persona.tagline}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-muted/70">
                {persona.sees}
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-4 w-4 shrink-0 text-line-strong transition-colors duration-150 group-hover:text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-fail">
          {error}
        </p>
      )}
    </div>
  );
}
