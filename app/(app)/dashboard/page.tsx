import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard sales" description="Ringkasan CRM yang perlu ditindaklanjuti hari ini." action={<Button render={<Link href="/crm/follow-up" />} nativeButton={false}>Buka Follow-up</Button>} />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.45fr)]" aria-hidden="true">
        <div className="rounded-xl border p-5"><Skeleton className="h-5 w-44" /><Skeleton className="mt-4 h-7 w-36" /></div>
        <div className="rounded-xl border p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></Skeleton></div>
      </section>
      <section className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, cardIndex) => (
          <div key={`document-preview-${cardIndex}`} className="rounded-xl border p-5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            <div className="mt-5 flex flex-col gap-4">
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <div key={`document-preview-${cardIndex}-${rowIndex}`} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                  </div>
                  <Skeleton className="h-6 w-20 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border p-5"><Skeleton className="h-5 w-28" /><Skeleton className="mt-4 h-48" /></div>
        <div className="rounded-xl border p-5"><Skeleton className="h-5 w-36" /><Skeleton className="mt-4 h-48" /></div>
      </div>
    </>
  );
}
