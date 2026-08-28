import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function CRMLoading() {
  return (
    <LoadingPage label="Memuat pipeline CRM">
      <PageHeaderSkeleton action />

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
            <div className="flex flex-col gap-2">
              {Array.from({ length: column === 0 ? 2 : 1 }, (_, item) => (
                <Card key={`column-${column}-card-${item}`} size="sm">
                  <CardHeader>
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-16" /></div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LoadingPage>
  );
}
