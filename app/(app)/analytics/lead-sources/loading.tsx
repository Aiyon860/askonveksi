import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadSourceRevenueLoading() {
  return (
    <LoadingPage label="Memuat laporan sumber lead dan omzet">
      <PageHeaderSkeleton />

      <Card size="sm" aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="sm:flex-row sm:items-end">
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-36" />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3 bg-card p-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-36 max-w-full" />
            </div>
          ))}
        </div>
      </section>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent><Skeleton className="h-80 w-full" /></CardContent>
      </Card>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent><TableSkeleton columns={4} /></CardContent>
      </Card>
    </LoadingPage>
  );
}
