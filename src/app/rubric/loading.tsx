import { LoadingRegion, PageHeaderSkeleton, TableSkeleton } from "@/components/skeleton";

export default function RubricLoading() {
  return (
    <LoadingRegion label="Loading the rubric">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} />
    </LoadingRegion>
  );
}
