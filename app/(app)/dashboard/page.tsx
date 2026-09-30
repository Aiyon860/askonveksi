import { Suspense } from "react";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LoadingPage } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard sales"
        description="Ringkasan CRM yang perlu ditindaklanjuti hari ini."
      />
      <Suspense
        fallback={
          <LoadingPage label="Memuat dashboard">
            <DashboardSkeleton />
          </LoadingPage>
        }
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
