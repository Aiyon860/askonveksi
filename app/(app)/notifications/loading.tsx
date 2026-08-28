import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <LoadingPage label="Memuat notifikasi">
      <PageHeaderSkeleton action />

      <section className="overflow-hidden rounded-lg border bg-card" aria-hidden="true">
        <div className="flex flex-col gap-4 border-b bg-muted/30 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full sm:h-9 sm:w-40" />
            </div>
            <Skeleton className="h-11 w-full sm:h-9 sm:w-44" />
          </div>
        </div>

        {["Hari ini", "Sebelumnya"].map((group) => (
          <div key={group}>
            <div className="border-b bg-muted/50 px-4 py-2.5 sm:px-5">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={`${group}-${index}`} className="flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
                  <div className="flex gap-2 sm:flex-col">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="h-4 w-full max-w-xl" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-11 w-full sm:h-8 sm:w-28" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </LoadingPage>
  );
}
