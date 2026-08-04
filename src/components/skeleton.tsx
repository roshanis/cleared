import { Card } from "./ui";

/* Loading placeholders. Each mirrors the real layout's shape so the page
   doesn't jump when data arrives. */

function Bar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse-soft rounded bg-well ${className}`}
    />
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 border-b border-line pb-5">
      <Bar className="h-7 w-52" />
      <Bar className="mt-3 h-4 w-80 max-w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-rail px-4 py-3">
        <Bar className="h-3 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Bar className="h-4 w-1/3" />
            <Bar className="h-4 w-20" />
            <Bar className="ml-auto h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MetricsSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-4 lg:py-5">
            <Bar className="h-3 w-24" />
            <Bar className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="p-5">
      <Bar className="h-4 w-44" />
      <Bar className="mt-5 h-28 w-full" />
    </Card>
  );
}

/** Announce loading to assistive tech without repeating it per placeholder. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
