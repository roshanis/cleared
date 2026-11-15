"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "./ui";

interface PersonaOption {
  id: string;
  name: string;
  role: string;
}

export function DemoBanner({
  current,
  others,
  hint,
}: {
  current: PersonaOption;
  others: PersonaOption[];
  hint: { href: string; text: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(personaId: string) {
    setPending(personaId);
    setError(null);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
      const body = (await res.json().catch(() => null)) as {
        home?: string;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Switch failed.");
      router.push(body?.home ?? "/");
      router.refresh();
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed.");
      setPending(null);
    }
  }

  return (
    /* A landmark, so the seat controls belong to a region a screen reader
       can jump to instead of floating between the header and main. */
    <aside aria-label="Demo controls" className="border-b border-line bg-rail">
      <div className="gutter mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 py-2 text-[13px] leading-5">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent-strong"
          >
            {initials(current.name)}
          </span>
          {/* "Viewing as" is the first thing to go on a phone: dropping it is
              what lets the seat switcher share this row instead of taking one
              of its own. */}
          <span className="hidden sm:inline">Viewing as</span>
          {current.name}
          <span className="font-normal text-muted">· {current.role}</span>
        </span>
        <Link
          href={hint.href}
          className="touch-band order-last min-w-0 basis-full truncate text-muted underline sm:order-none sm:basis-auto decoration-line-strong underline-offset-2 transition-colors duration-150 hover:text-accent-strong hover:decoration-accent sm:overflow-visible sm:whitespace-normal"
        >
          Try: {hint.text}
        </Link>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="hidden text-muted sm:inline">Switch seat</span>
          {others.map((persona) => (
            <button
              key={persona.id}
              type="button"
              onClick={() => switchTo(persona.id)}
              disabled={pending !== null}
              title={`${persona.name} · ${persona.role}`}
              className="touch-target inline-flex min-h-7 items-center justify-center gap-1 rounded-md border border-line bg-surface px-2.5 py-0.5 font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-accent-strong disabled:pointer-events-none disabled:opacity-60"
            >
              {pending === persona.id ? "…" : persona.name.split(" ")[0]}
            </button>
          ))}
        </span>
        {error && (
          <span role="alert" className="basis-full font-medium text-fail">
            {error}
          </span>
        )}
      </div>
    </aside>
  );
}
