import {
  FormCardSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <LoadingPage label="Memuat pengguna aplikasi">
      <PageHeaderSkeleton />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden="true">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-2">
              <Skeleton className="h-9 w-full sm:max-w-md" />
              <Skeleton className="h-9 w-24 shrink-0" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="min-h-112">
            <TableSkeleton columns={7} rows={8} className="min-w-232" />
          </div>
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-48" />
          </div>
        </section>

        <FormCardSkeleton fields={4} />
      </div>
    </LoadingPage>
  );
}
