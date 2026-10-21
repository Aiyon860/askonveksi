export function LeadSourcesSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Intelligence Ribbon Skeleton */}
      <div className="neu-card rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="size-10 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
          <div className="space-y-1">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </div>

      {/* 6 Top Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="neu-card rounded-2xl p-6 flex flex-col justify-between min-h-[170px]">
            <div className="flex items-center justify-between">
              <div className="size-14 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
              <div className="h-3 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart Section Skeleton */}
      <div className="neu-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="h-80 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
      </div>

      {/* Worktable Skeleton */}
      <div className="neu-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-10 w-72 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
