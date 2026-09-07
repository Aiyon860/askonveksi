import { Suspense } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { PipelineBoardSection } from "@/components/crm/pipeline-board-section";

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

function PipelineSkeleton() {
  return (
    <>
      <section className="grid gap-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-12" />
        </div>
        <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-hidden pb-1 xl:grid-cols-5 xl:auto-cols-auto xl:grid-flow-row">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={`summary-${index}`} className="flex flex-col gap-2 rounded-xl border p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-hidden pb-3 xl:grid-cols-5 xl:auto-cols-auto xl:grid-flow-row" aria-hidden="true">
        {Array.from({ length: 5 }, (_, column) => (
          <section key={`column-${column}`} className="min-h-[24rem] rounded-xl border bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-5" />
            </div>
            <Skeleton className="h-32 w-full" />
          </section>
        ))}
      </div>
    </>
  );
}
