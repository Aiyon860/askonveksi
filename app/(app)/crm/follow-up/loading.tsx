import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BroadcastLoading() {
  return (
    <LoadingPage label="Memuat broadcast">
      <PageHeaderSkeleton />
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-9 w-full sm:max-w-xs" />
            <Skeleton className="h-4 w-40" />
          </div>
          <TableSkeleton columns={4} rows={8} columnWidths={["w-8", "w-40", "w-28", "w-16"]} />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
