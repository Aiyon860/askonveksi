import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { productionStages } from "@/lib/production/workflow";

export default function ProductionLoading() {
  const stages = productionStages("JERSEY");

  return (
    <LoadingPage label="Memuat kanban Produksi">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-48" />

      <div aria-hidden="true" className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`total-${index}`} className="flex flex-col gap-2 rounded-lg border p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <div className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-hidden pb-1 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-7">
          {stages.map((stage) => (
            <div key={stage} className="flex flex-col gap-2 rounded-lg border p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <div className="grid auto-cols-[20rem] grid-flow-col gap-3 overflow-x-hidden pb-3">
          {stages.map((stage, column) => (
            <section key={`column-${stage}`} className="min-h-[24rem] rounded-lg border bg-muted/20 p-2">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-5" />
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: column === 0 ? 2 : 1 }, (_, item) => (
                  <div key={`column-${stage}-card-${item}`} className="flex flex-col gap-3 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /></div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
