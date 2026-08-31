import {
  BackLinkSkeleton,
  CardHeaderSkeleton,
  FormCardSkeleton,
  FormSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunityDetailLoading() {
  return (
    <LoadingPage label="Memuat detail peluang">
      <BackLinkSkeleton />
      <PageHeaderSkeleton action />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeaderSkeleton />
            <CardContent>
              <section className="flex flex-col gap-4 rounded-lg border border-info/20 bg-info/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
                <TableSkeleton columns={4} rows={3} />
                <div className="ml-auto flex w-full max-w-xs flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeaderSkeleton />
            <CardContent className="gap-5">
              <FormSkeleton fields={3} columns={3} />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-36" />
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={`communication-${index}`} className="h-24 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/6 p-3 sm:p-4">
          <FormCardSkeleton fields={2} />
          <FormCardSkeleton fields={4} />
          <Card size="sm">
            <CardHeaderSkeleton action />
            <CardContent className="gap-3">
              <Skeleton className="h-4 w-2/3" />
              <FormSkeleton fields={3} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </LoadingPage>
  );
}
