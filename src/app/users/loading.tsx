import { LoadingRegion, PageHeaderSkeleton, TableSkeleton } from "@/components/skeleton";

export default function UsersLoading() {
  return (
    <LoadingRegion label="Loading users">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} />
    </LoadingRegion>
  );
}
