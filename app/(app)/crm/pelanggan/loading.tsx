import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <LoadingPage label="Memuat data customer">
      <PageHeaderSkeleton />

      <section className="overflow-hidden rounded-xl border bg-background" aria-hidden="true">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-2">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <TableSkeleton columns={8} rows={8} className="min-w-5xl" />
        <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-52" />
        </div>
      </section>
    </LoadingPage>
  );
}
