"use client";

import { useState } from "react";
import type { DayVolume } from "@/lib/metrics";

/* Client-side dashboard charts: same marks as before, but with a styled
   hover tooltip instead of the browser's native <title> bubble. */

const OUTCOME_SERIES = [
  { key: "pass", label: "Passed", color: "var(--color-chart-pass)" },
  {
    key: "needsHumanReview",
    label: "Needs review",
    color: "var(--color-chart-warn)",
  },
  { key: "fail", label: "Failed", color: "var(--color-chart-fail)" },
  {
    key: "other",
    label: "In progress / errored",
    color: "var(--color-line-strong)",
  },
] as const;

function dayLabel(day: DayVolume): string {
  if (day.count === 0) return `${day.day}: no reviews`;
  const parts = OUTCOME_SERIES.filter((series) => day[series.key] > 0).map(
    (series) => `${day[series.key]} ${series.label.toLowerCase()}`,
  );
  return `${day.day}: ${day.count} review${day.count === 1 ? "" : "s"} — ${parts.join(", ")}`;
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function Tooltip({
  children,
  x,
}: {
  children: React.ReactNode;
  /** Horizontal center of the hovered mark, as a fraction of chart width. */
  x: number;
}) {
  // Keep the bubble inside the card: anchor left/center/right by position.
  const align =
    x < 0.2
      ? "left-0"
      : x > 0.8
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -top-2 z-10 -translate-y-full ${align} min-w-40 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-raised`}
      style={{
        left:
          x >= 0.2 && x <= 0.8 ? `${x * 100}%` : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function OutcomesBar({
  pass,
  needsHumanReview,
  fail,
}: {
  pass: number;
  needsHumanReview: number;
  fail: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = pass + needsHumanReview + fail;
  if (total === 0) return null;
  const segments = [
    { label: "Passed", count: pass, color: "var(--color-chart-pass)" },
    {
      label: "Needs human review",
      count: needsHumanReview,
      color: "var(--color-chart-warn)",
    },
    { label: "Failed", count: fail, color: "var(--color-chart-fail)" },
  ].filter((segment) => segment.count > 0);

  return (
    <div className="relative">
      {hover !== null && segments[hover] && (
        <Tooltip
          x={
            segments.slice(0, hover).reduce((sum, s) => sum + s.count, 0) /
              total +
            segments[hover].count / total / 2
          }
        >
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Dot color={segments[hover].color} />
            {segments[hover].label}
          </p>
          <p className="mt-1 text-muted">
            <span className="font-semibold tabular-nums text-ink">
              {segments[hover].count}
            </span>{" "}
            of {total} · {Math.round((segments[hover].count / total) * 100)}%
          </p>
        </Tooltip>
      )}
      <div
        role="group"
        aria-label={`Review outcomes: ${pass} passed, ${needsHumanReview} need human review, ${fail} failed`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map((segment, i) => {
          return (
            <button
              key={segment.label}
              type="button"
              // Focusable so the breakdown is reachable by keyboard, not just
              // by hover; the label carries the same numbers as the tooltip.
              aria-label={`${segment.label}: ${segment.count} of ${total}, ${Math.round((segment.count / total) * 100)}%`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${
                i === segments.length - 1 ? "rounded-r-full" : ""
              } ${hover !== null && hover !== i ? "opacity-60" : ""} transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              style={{
                width: `${(segment.count / total) * 100}%`,
                background: segment.color,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function VolumeChart({ days }: { days: DayVolume[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxVolume = Math.max(1, ...days.map((d) => d.count));
  const width = days.length * 24;
  const hovered = hover !== null ? days[hover] : null;

  return (
    <div className="relative">
      {hovered && (
        <Tooltip x={(hover! * 24 + 12) / width}>
          <p className="font-semibold text-ink">{hovered.day}</p>
          <p className="mt-0.5 text-muted">
            {hovered.count} review{hovered.count === 1 ? "" : "s"}
          </p>
          {hovered.count > 0 && (
            <div className="mt-1.5 space-y-1">
              {OUTCOME_SERIES.filter((series) => hovered[series.key] > 0).map(
                (series) => (
                  <p
                    key={series.key}
                    className="flex items-center gap-1.5 text-muted"
                  >
                    <Dot color={series.color} />
                    {series.label}
                    <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
                      {hovered[series.key]}
                    </span>
                  </p>
                ),
              )}
            </div>
          )}
        </Tooltip>
      )}
      <svg
        viewBox={`0 0 ${width} 84`}
        className="h-28 w-full"
        role="list"
        aria-label="Reviews per day for the last 14 days, split by outcome"
      >
        {days.map((day, i) => {
          const x = i * 24 + 4;
          const scale = 64 / maxVolume;
          const segments = OUTCOME_SERIES.map((series) => ({
            count: day[series.key],
            fill: series.color,
          })).filter((segment) => segment.count > 0);
          let y = 68;
          const rects = segments.map((segment, s) => {
            const height = Math.max(segment.count * scale, 3);
            y -= height;
            const isTop = s === segments.length - 1;
            return (
              <rect
                key={s}
                x={x}
                y={y}
                width={16}
                height={isTop ? height : Math.max(height - 1.5, 1.5)}
                rx={isTop ? 2 : 0}
                fill={segment.fill}
              />
            );
          });
          return (
            <g
              key={day.day}
              role="listitem"
              tabIndex={0}
              aria-label={dayLabel(day)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={`focus:outline-none ${
                hover !== null && hover !== i
                  ? "opacity-60 transition-opacity duration-150"
                  : "transition-opacity duration-150"
              }`}
            >
              {hover === i && (
                <rect
                  x={i * 24 + 1}
                  y={2}
                  width={22}
                  height={78}
                  rx={3}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                />
              )}
              {/* Full-column hit target so hovering anywhere over the day works */}
              <rect x={i * 24} y={0} width={24} height={84} fill="transparent" />
              {day.count === 0 && (
                <rect x={x} y={67} width={16} height={1} fill="var(--color-line)" />
              )}
              {rects}
              <text
                x={x + 8}
                y={80}
                textAnchor="middle"
                fontSize="7"
                fill="var(--color-muted)"
              >
                {day.day.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
