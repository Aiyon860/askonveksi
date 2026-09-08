import { LoadingPage, FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <LoadingPage label="Memuat data customer">
      <PageHeaderSkeleton />

      <section className="overflow-hidden rounded-lg border bg-card" aria-hidden="true">
        <FilterBarSkeleton searchWidth="w-full sm:max-w-md" actionWidth="w-36" controls={2} />
        <TableSkeleton
          columns={8}
          rows={8}
          className="min-w-5xl"
          columnWidths={["w-12", "w-36", "w-32", "w-28", "w-24", "w-24", "w-24", "w-24"]}
        />
        <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-52" />
        </div>
      </section>
    </LoadingPage>
  );
}
