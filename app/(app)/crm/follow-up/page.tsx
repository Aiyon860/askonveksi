import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowUpContent } from "@/components/crm/follow-up-content";

const BUCKETS = ["overdue", "today", "tomorrow", "upcoming"] as const;
type Bucket = (typeof BUCKETS)[number];
const BUCKET_LABEL: Record<Bucket, string> = { overdue: "Terlambat", today: "Hari ini", tomorrow: "Besok", upcoming: "Mendatang" };
const BUCKET_THEME: Record<Bucket, { surface: string; count: string }> = {
  overdue: { surface: "border-destructive/25 bg-destructive/5 hover:bg-destructive/10", count: "text-destructive" },
  today: { surface: "border-warning/25 bg-warning/5 hover:bg-warning/10", count: "text-warning" },
  tomorrow: { surface: "border-info/25 bg-info/5 hover:bg-info/10", count: "text-info" },
  upcoming: { surface: "border-success/25 bg-success/5 hover:bg-success/10", count: "text-success" },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ bucket?: string | string[]; pic?: string | string[] }> }) {
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
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
      <Skeleton className="h-128" />
    </>
  );
}
