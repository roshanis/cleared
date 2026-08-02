"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "cleared-theme";

/**
 * Runs before first paint (see layout) so a stored preference is applied
 * without a flash of the wrong theme. Kept as a string because it has to be
 * inlined in <head>, ahead of the bundle.
 */
export const themeInitScript = `(()=>{try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    delete root.dataset.theme;
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Private mode / storage disabled — the choice still applies this visit.
    }
    return;
  }
  root.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Same as above: honor the click, just don't persist it.
  }
}

const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="1.8" y="2.8" width="12.4" height="8.4" rx="1.2" />
        <path d="M5.5 13.6h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Ignore — fall back to following the system.
    }
    setChoice(stored === "light" || stored === "dark" ? stored : "system");
    setReady(true);
  }, []);

  return (
    <div
      role="group"
      aria-label="Color theme"
      // Hidden until the stored choice is known, so the control never shows
      // the wrong option selected for a frame.
      className={`flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 ${
        ready ? "" : "invisible"
      }`}
    >
      {options.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={`${option.label} theme`}
            onClick={() => {
              setChoice(option.value);
              apply(option.value);
            }}
            className={`inline-flex h-6 w-7 items-center justify-center rounded transition-colors duration-150 ${
              active
                ? "bg-accent-soft text-accent-strong"
                : "text-subtle hover:text-ink"
            }`}
          >
            {option.icon}
            <span className="sr-only">{option.label} theme</span>
          </button>
        );
      })}
    </div>
  );
}
