import { LoadingPage, MetricStripSkeleton, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FollowUpLoading() {
  return (
    <LoadingPage label="Memuat follow-up">
      <PageHeaderSkeleton />
      <MetricStripSkeleton
        items={4}
        layoutClassName="grid-cols-2 lg:grid-cols-4"
        itemClassName="p-4"
        labelWidths={["w-20", "w-20", "w-20", "w-20"]}
        valueWidths={["w-10", "w-10", "w-10", "w-10"]}
      />
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="flex flex-col gap-5 divide-y">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`follow-up-${index}`} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-5 w-56 max-w-full" />
                  <Skeleton className="h-4 w-80 max-w-full" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
