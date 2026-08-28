import {
  BackLinkSkeleton,
  CardHeaderSkeleton,
  FormCardSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesOrderLoading() {
  return (
    <LoadingPage label="Memuat Sales Order">
      <BackLinkSkeleton />
      <PageHeaderSkeleton action />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeaderSkeleton />
            <CardContent className="gap-5">
              <TableSkeleton columns={4} rows={5} />
              <div className="ml-auto flex w-full max-w-sm flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeaderSkeleton />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={`customer-${index}`} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-36 max-w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/6 p-3 sm:p-4">
          <Card>
            <CardHeaderSkeleton />
            <CardContent className="gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-44" />
            </CardContent>
          </Card>
          <FormCardSkeleton fields={1} />
        </aside>
      </div>
    </LoadingPage>
  );
}
