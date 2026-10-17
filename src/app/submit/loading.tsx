import { LoadingRegion, PageHeaderSkeleton } from "@/components/skeleton";

export default function SubmitLoading() {
  return (
    <LoadingRegion label="Loading the submit form">
      <PageHeaderSkeleton />
      <div className="animate-pulse-soft space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
        <div className="h-10 w-full rounded-md bg-well" />
        <div className="h-8 w-56 rounded-md bg-well" />
        <div className="h-64 w-full rounded-md bg-well" />
      </div>
    </LoadingRegion>
  );
}
