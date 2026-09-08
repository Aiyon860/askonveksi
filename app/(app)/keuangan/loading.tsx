import { LoadingPage, MetricStripSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <LoadingPage label="Memuat keuangan">
      <PageHeaderSkeleton />
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full max-w-lg" />
        </CardContent>
      </Card>
      <MetricStripSkeleton
        items={4}
        layoutClassName="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4"
        itemClassName="p-5"
        labelWidths={["w-24", "w-24", "w-28", "w-28"]}
        valueWidths={["w-36", "w-36", "w-36", "w-36"]}
      />
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={6} rows={6} columnWidths={["w-40", "w-24", "w-24", "w-24", "w-24", "w-24"]} />
        </CardContent>
      </Card>
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
