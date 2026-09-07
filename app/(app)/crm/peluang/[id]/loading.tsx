import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function OpportunityDetailLoading() {
  return (
    <LoadingPage label="Memuat detail peluang">
      <PageHeaderSkeleton action />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <aside className="flex flex-col gap-4 rounded-xl border p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </aside>
      </div>
    </LoadingPage>
  );
}
