import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function QueueLoading() {
  return (
    <LoadingRegion label="Loading the review queue">
      <PageHeaderSkeleton />
      <TableSkeleton rows={3} />
    </LoadingRegion>
  );
}
