import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CardHeadingSkeleton() {
  return (
    <CardHeader>
      <Skeleton className="h-5 w-44 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </CardHeader>
  );
}

export default function DashboardLoading() {
  return (
    <LoadingPage label="Memuat dashboard">
      <PageHeaderSkeleton action />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.45fr)]" aria-hidden="true">
        <Card>
          <CardHeadingSkeleton />
          <CardContent>
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={`sales-metric-${index}`} className="flex min-h-32 flex-col gap-3 bg-card p-5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-7 w-36 max-w-full" />
                  {index === 2 ? <Skeleton className="h-3 w-32 max-w-full" /> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeadingSkeleton />
          <CardContent>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={`follow-up-metric-${index}`} className="flex min-h-32 flex-col gap-3 bg-card p-4">
                  <Skeleton className="h-4 w-20 max-w-full" />
                  <Skeleton className="h-8 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-hidden pb-1 xl:grid-cols-8 xl:grid-flow-row">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={`pipeline-stage-${index}`} className="flex min-h-24 flex-col gap-3 rounded-lg border bg-card p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, cardIndex) => (
          <Card key={`dashboard-list-${cardIndex}`}>
            <CardHeadingSkeleton />
            <CardContent>
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <div key={`dashboard-list-${cardIndex}-${rowIndex}`} className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-6 w-20 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </LoadingPage>
  );
}
