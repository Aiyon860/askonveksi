import {
  BackLinkSkeleton,
  CardHeaderSkeleton,
  FormCardSkeleton,
  FormSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <LoadingPage label="Memuat detail customer">
      <BackLinkSkeleton />
      <PageHeaderSkeleton />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeaderSkeleton />
            <CardContent>
              <TableSkeleton columns={4} rows={4} />
            </CardContent>
          </Card>

          <Card>
            <CardHeaderSkeleton />
            <CardContent className="gap-5">
              <FormSkeleton fields={2} columns={2} />
              <FormSkeleton fields={3} columns={3} />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-9 w-36" />
            </CardContent>
            <CardFooter className="justify-between border-t">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-24" />
            </CardFooter>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <FormCardSkeleton fields={4} />
          <Card size="sm">
            <CardHeaderSkeleton action />
            <CardContent className="gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </LoadingPage>
  );
}
