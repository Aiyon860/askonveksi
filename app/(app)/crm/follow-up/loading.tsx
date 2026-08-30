import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function FollowUpLoading() {
  return (
    <>
      <PageHeader title="Follow-up" description="Memuat tindakan yang perlu dikerjakan." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div>
      <Skeleton className="h-128" />
    </>
  );
}
