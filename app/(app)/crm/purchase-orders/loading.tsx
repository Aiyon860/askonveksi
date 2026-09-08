import { LoadingPage, FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersLoading() {
  return (
    <LoadingPage label="Memuat purchase order">
      <PageHeaderSkeleton action />
      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background" aria-hidden="true">
        <FilterBarSkeleton searchWidth="w-full sm:max-w-md" actionWidth="w-36" controls={3} />
        <div className="flex min-h-112 flex-1 flex-col">
          <TableSkeleton
            columns={7}
            rows={8}
            className="min-w-4xl"
            columnWidths={["w-12", "w-32", "w-32", "w-36", "w-20", "w-24", "w-24"]}
          />
        </div>
        <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-52" />
        </div>
      </section>
    </LoadingPage>
  );
}
