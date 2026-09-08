import { Suspense } from "react";

import { FollowUpContent } from "@/components/crm/follow-up-content";
import { LoadingPage, MetricStripSkeleton, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Skeleton } from "@/components/ui/skeleton";

const BUCKETS = ["overdue", "today", "tomorrow", "upcoming"] as const;
type Bucket = (typeof BUCKETS)[number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string | string[]; pic?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawBucket = first(params.bucket);
  const bucket: Bucket = BUCKETS.includes(rawBucket as Bucket) ? rawBucket as Bucket : "today";
  const picId = first(params.pic);

  return (
    <>
      <PageHeader title="Follow-up" description="Kerjakan tindakan yang jatuh tempo, catat hasilnya, lalu tetapkan langkah berikutnya." />
      <PageMessage />

      <Suspense fallback={<FollowUpSkeleton />} key={`${bucket}-${picId ?? "all"}`}>
        <FollowUpContent bucket={bucket} picId={picId} />
      </Suspense>
    </>
  );
}

function FollowUpSkeleton() {
  return (
    <LoadingPage label="Memuat follow-up">
      <PageHeaderSkeleton />
      <MetricStripSkeleton
        items={4}
        layoutClassName="grid-cols-2 lg:grid-cols-4"
        itemClassName="p-4"
        labelWidths={["w-20", "w-20", "w-20", "w-20"]}
        valueWidths={["w-10", "w-10", "w-10", "w-10"]}
      />
      <div className="rounded-xl border bg-background" aria-hidden="true">
        <div className="flex items-center justify-between border-b p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="flex flex-col divide-y">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`follow-up-${index}`} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-5 w-56 max-w-full" />
                  <Skeleton className="h-4 w-80 max-w-full" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingPage>
  );
}
