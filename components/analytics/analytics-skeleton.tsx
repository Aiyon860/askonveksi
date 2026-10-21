import React from "react";

export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-base text-slate-800 dark:text-slate-100 w-full animate-pulse pb-16">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 bg-slate-200 dark:bg-slate-800 rounded-2xl shrink-0" />
          <div className="flex flex-col gap-2">
            <div className="h-8 w-80 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-5 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-11 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Sleek Intelligence Ribbon Skeleton */}
      <div className="neu-card rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-5 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </div>

      {/* Top 4 Executive Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="neu-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="size-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="my-4 h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>

      {/* Connected Pipeline Stepper Skeleton (4 Top, 4 Bottom) */}
      <div className="neu-card rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/5">
          <div className="h-6 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="neu-inset p-5 rounded-2xl h-36 flex flex-col justify-between" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="neu-inset p-5 rounded-2xl h-36 flex flex-col justify-between" />
          ))}
        </div>
      </div>

      {/* Chart Skeleton */}
      <div className="neu-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
        <div className="h-96 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      </div>

      {/* Tabbed Worktable Skeleton */}
      <div className="neu-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/5">
          <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
        <div className="h-72 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}
