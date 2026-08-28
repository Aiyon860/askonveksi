import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MasterDataLoading() {
  return (
    <LoadingPage label="Memuat master data">
      <PageHeaderSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden="true">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="min-h-112">
            <TableSkeleton columns={7} rows={8} className="min-w-4xl" />
          </div>
        </section>
        <Card><CardHeader><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-56" /></CardHeader><CardContent className="flex flex-col gap-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></CardContent></Card>
      </div>
    </LoadingPage>
  );
}
