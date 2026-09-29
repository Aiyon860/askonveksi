import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function DashboardLoading() {
  return (
    <LoadingPage label="Memuat dashboard">
      <PageHeaderSkeleton action />
      <DashboardSkeleton />
    </LoadingPage>
  );
}
