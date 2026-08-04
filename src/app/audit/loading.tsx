import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function AuditLoading() {
  return (
    <LoadingRegion label="Loading the audit log">
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} />
    </LoadingRegion>
  );
}
