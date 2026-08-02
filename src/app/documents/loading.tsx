import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function DocumentsLoading() {
  return (
    <LoadingRegion label="Loading documents">
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} />
    </LoadingRegion>
  );
}
