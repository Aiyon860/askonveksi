import { LoadingPage, FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MasterDataLoading() {
  return (
    <LoadingPage label="Memuat master data">
      <PageHeaderSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden="true">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
          <FilterBarSkeleton searchWidth="w-full sm:max-w-md" actionWidth="w-36" controls={2} />
          <div className="min-h-112">
            <TableSkeleton
              columns={7}
              rows={8}
              className="min-w-4xl"
              columnWidths={["w-12", "w-40", "w-24", "w-32", "w-32", "w-24", "w-28"]}
            />
          </div>
        </section>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </LoadingPage>
  );
}
