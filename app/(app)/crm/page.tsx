import { Suspense } from "react";

import { PageMessage } from "@/components/page-message";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, KanbanSkeleton } from "@/components/loading-skeletons";
import { PipelineBoardSection } from "@/components/crm/pipeline-board-section";

function PipelineSkeleton() {
  return (
    <LoadingPage label="Memuat pipeline CRM">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <div className="flex min-h-9 min-w-0 items-center gap-4 overflow-hidden py-1">
          <Skeleton className="h-5 w-28 shrink-0" />
          <div className="flex items-center gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </section>
      <KanbanSkeleton columns={5} cardsPerColumn={[2, 1, 1, 1, 1]} />
    </LoadingPage>
  );
}

export default function CRMPage() {
  return (
    <>
      <PageHeader
        title="Pipeline CRM"
        description="Satu kartu mewakili satu peluang. PO dan invoice disusun saat Negosiasi, lalu Admin mencatat pembayaran untuk Deal."
      />
      <PageMessage />
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineBoardSection />
      </Suspense>
    </>
  );
}
