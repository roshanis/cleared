import {
  ChartSkeleton,
  LoadingRegion,
  MetricsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading the dashboard">
      <PageHeaderSkeleton />
      <div className="space-y-8">
        <MetricsSkeleton />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    </LoadingRegion>
  );
}
