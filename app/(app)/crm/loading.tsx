import { LoadingPage, KanbanSkeleton, MetricStripSkeleton, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CRMLoading() {
  return (
    <LoadingPage label="Memuat pipeline CRM">
      <PageHeaderSkeleton action />

      <section className="grid gap-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-12" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <MetricStripSkeleton
              items={5}
              layoutClassName="grid-cols-2 xl:grid-cols-5"
              itemClassName="p-4"
              labelWidths={["w-20", "w-20", "w-20", "w-20", "w-20"]}
              valueWidths={["w-10", "w-10", "w-10", "w-10", "w-10"]}
            />
          </CardContent>
        </Card>
      </section>

      <KanbanSkeleton columns={5} cardsPerColumn={[2, 1, 1, 1, 1]} />
    </LoadingPage>
  );
}
