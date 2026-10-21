import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {/* Top Search & Utilities Skeleton */}
      <div className="flex h-14 items-center justify-between rounded-2xl neu-card">
        <Skeleton className="h-9 w-72 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Banner Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* 6 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col justify-between rounded-2xl neu-card p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="size-12 rounded-2xl" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-24" />
            </div>
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Middle Row (3 Cards) Skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-2xl neu-card p-6 xl:col-span-5">
          <div className="flex items-center justify-between pb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        <div className="rounded-2xl neu-card p-6 xl:col-span-3">
          <Skeleton className="h-5 w-32" />
          <div className="my-4 flex items-center justify-center">
            <Skeleton className="size-44 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        <div className="rounded-2xl neu-card p-6 xl:col-span-4">
          <Skeleton className="h-5 w-44" />
          <div className="mt-6 flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row Skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-2xl neu-card p-6 xl:col-span-5">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl neu-card p-6 xl:col-span-3">
          <Skeleton className="h-5 w-36" />
          <div className="my-4 flex items-center justify-center">
            <Skeleton className="size-44 rounded-full" />
          </div>
        </div>

        <div className="rounded-2xl neu-card p-6 xl:col-span-4">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Insights Skeleton */}
      <div className="rounded-2xl neu-card p-6">
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
