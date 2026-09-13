import { LoadingRegion, PageHeaderSkeleton } from "@/components/skeleton";

export default function DocumentLoading() {
  return (
    <LoadingRegion label="Loading the document">
      <PageHeaderSkeleton />
      <div className="animate-pulse-soft space-y-4">
        <div className="h-24 w-full rounded-lg border border-line bg-surface" />
        <div className="h-72 w-full rounded-lg border border-line bg-surface" />
      </div>
    </LoadingRegion>
  );
}
