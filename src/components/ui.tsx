import type { ReviewResult } from "@/schema";
import type { Severity } from "@/lib/rubric";

/* Shared control vocabulary — every button and input in the app draws from
   these so the same action looks the same on every screen. */

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50";

const buttonVariants = {
  primary: "bg-accent text-white hover:bg-accent-strong active:bg-accent-strong",
  secondary:
    "border border-line-strong bg-surface text-accent-strong hover:border-accent hover:bg-accent-soft/70 active:bg-accent-soft",
  danger: "bg-fail text-white hover:bg-fail-strong active:bg-fail-strong",
  success: "bg-pass text-white hover:bg-pass-strong active:bg-pass-strong",
  ghost: "text-muted hover:bg-rail hover:text-ink active:bg-well",
} as const;

const buttonSizes = {
  md: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-8 px-3 py-1.5 text-xs",
} as const;

export function buttonClass(
  variant: keyof typeof buttonVariants = "primary",
  size: keyof typeof buttonSizes = "md",
): string {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]}`;
}

export const inputClass =
  "min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm transition-colors duration-150 placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-well disabled:text-muted";

export const selectClass =
  "min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-well disabled:text-muted";

export const textareaClass = `${inputClass} leading-6`;

export const fieldLabelClass = "mb-1.5 block text-sm font-medium";

const badgeTones = {
  neutral: "bg-well text-muted ring-line-strong",
  accent: "bg-accent-soft text-accent-strong ring-accent/20",
  pass: "bg-pass-soft text-pass ring-pass/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  fail: "bg-fail-soft text-fail ring-fail/25",
  info: "bg-info-soft text-info ring-info/20",
} as const;

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

const verdictStyles: Record<
  ReviewResult["verdict"],
  { label: string; className: string; dot: string }
> = {
  pass: {
    label: "Pass",
    className: "bg-pass-soft text-pass ring-pass/25",
    dot: "bg-pass",
  },
  fail: {
    label: "Fail",
    className: "bg-fail-soft text-fail ring-fail/25",
    dot: "bg-fail",
  },
  needs_human_review: {
    label: "Needs review",
    className: "bg-warn-soft text-warn ring-warn/25",
    dot: "bg-warn",
  },
};

export function VerdictBadge({ verdict }: { verdict: ReviewResult["verdict"] }) {
  const style = verdictStyles[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${style.className}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

const severityColors: Record<Severity, string> = {
  critical: "bg-fail",
  major: "bg-warn",
  minor: "bg-muted",
};

export function SeverityLabel({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${severityColors[severity]}`}
      />
      {severity}
    </span>
  );
}

/** Small mono chip for criterion IDs (C1, C2…) — used in tables and findings. */
export function CriterionChip({ id }: { id: string }) {
  return (
    <span className="inline-flex rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-4 text-accent-strong">
      {id}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function TableCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

/** Section heading — sentence case, sized; replaces uppercase eyebrows. */
export function SectionHeading({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <h2 className="flex items-baseline gap-2 text-sm font-semibold tracking-tight text-ink">
      {children}
      {count !== undefined && (
        <span className="text-xs font-medium tabular-nums text-muted">
          {count}
        </span>
      )}
    </h2>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span
        aria-hidden
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-5 w-5 text-accent-strong"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.5 4.5 6.4 11.6 2.5 7.7" />
        </svg>
      </span>
      <p className="text-base font-medium">{title}</p>
      <p className="max-w-md text-sm leading-6 text-muted">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

/** Table header cell — sentence case on the well band, consistent everywhere. */
export function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted ${className}`}
    >
      {children}
    </th>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60e3);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Numbered step for "how it works" explanations — extracted from SubmitForm
 *  so the landing page can reuse the same component. */
export function HowItWorksStep({
  step,
  title,
  detail,
}: {
  step: number;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent-strong"
      >
        {step}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}
