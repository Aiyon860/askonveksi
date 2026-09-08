import { LoadingPage, MetricStripSkeleton, PageHeaderSkeleton, SectionHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ListPreviewSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-0">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={`preview-row-${index}`}
          className="flex items-center justify-between gap-4 border-b px-0 py-3 last:border-b-0"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <div className="flex shrink-0 items-end gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.45fr)]" aria-hidden="true">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </CardHeader>
          <CardContent>
            <MetricStripSkeleton
              items={3}
              layoutClassName="md:grid-cols-3"
              wideLast
              labelWidths={["w-24", "w-36", "w-28"]}
              valueWidths={["w-36", "w-40", "w-32"]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <MetricStripSkeleton
              items={2}
              layoutClassName="grid-cols-2"
              itemClassName="p-4"
              labelWidths={["w-28", "w-24"]}
              valueWidths={["w-16", "w-16"]}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-hidden="true">
        <Card>
          <CardHeader>
            <SectionHeaderSkeleton
              titleWidth="w-40"
              descriptionWidth="w-80 max-w-full"
            />
          </CardHeader>
          <CardContent>
            <MetricStripSkeleton
              items={5}
              layoutClassName="grid-cols-2 lg:grid-cols-5"
              itemClassName="p-4"
              labelWidths={["w-20", "w-20", "w-20", "w-20", "w-20"]}
              valueWidths={["w-20", "w-20", "w-20", "w-20", "w-20"]}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, cardIndex) => (
          <Card key={`document-preview-${cardIndex}`}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent>
              <ListPreviewSkeleton rows={5} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-hidden="true">
        <Card>
          <CardHeader>
            <SectionHeaderSkeleton titleWidth="w-28" descriptionWidth="w-64 max-w-full" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={`pipeline-stage-${index}`} className="flex min-h-24 flex-col gap-3 bg-card p-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-7 w-10" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-hidden="true" className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <ListPreviewSkeleton rows={5} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function DashboardLoading() {
  return (
    <LoadingPage label="Memuat dashboard">
      <PageHeaderSkeleton action />
      <DashboardSkeleton />
    </LoadingPage>
  );
}
