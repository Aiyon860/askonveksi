import { LoadingPage, FilterBarSkeleton, MetricStripSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesPerformanceLoading() {
  return (
    <LoadingPage label="Memuat laporan performa sales">
      <PageHeaderSkeleton />

      <Card size="sm" aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <FilterBarSkeleton searchWidth="w-full sm:max-w-xs" actionWidth="w-36" controls={1} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <MetricStripSkeleton
          items={5}
          layoutClassName="grid-cols-2 lg:grid-cols-5"
          itemClassName="p-5"
          wideLast
          labelWidths={["w-20", "w-28", "w-24", "w-20", "w-20"]}
          valueWidths={["w-12", "w-12", "w-12", "w-12", "w-28"]}
        />
      </section>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={6} columnWidths={["w-40", "w-12", "w-16", "w-16", "w-16", "w-24"]} />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
