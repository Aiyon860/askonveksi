import { Suspense } from "react";

import { PageMessage } from "@/components/page-message";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, KanbanSkeleton, MetricStripSkeleton } from "@/components/loading-skeletons";
import { PipelineBoardSection } from "@/components/crm/pipeline-board-section";

function PipelineSkeleton() {
  return (
    <LoadingPage label="Memuat pipeline CRM">
      <section className="grid gap-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-12" />
        </div>
        <MetricStripSkeleton
          items={5}
          layoutClassName="grid-cols-2 xl:grid-cols-5"
          itemClassName="p-4"
          labelWidths={["w-20", "w-20", "w-20", "w-20", "w-20"]}
          valueWidths={["w-10", "w-10", "w-10", "w-10", "w-10"]}
        />
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
