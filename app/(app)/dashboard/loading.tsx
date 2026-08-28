import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function DashboardLoading() {
  return (
    <LoadingPage label="Memuat dashboard">
      <PageHeaderSkeleton action />

      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={`metric-${index}`} className="flex items-start justify-between gap-4 bg-card p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-36 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-9 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {["xl:col-span-3", "xl:col-span-2"].map((span, index) => (
            <Card key={`chart-${index}`} className={span}>
              <CardHeader className="flex-row items-start justify-between border-b">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={`workspace-${index}`}>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, item) => (
                <Skeleton key={`workspace-${index}-item-${item}`} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </LoadingPage>
  );
}
