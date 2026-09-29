import { Suspense } from "react";

import { BroadcastContent } from "@/components/crm/broadcast-content";
import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BroadcastPage() {
  return (
    <>
      <PageHeader
        title="Broadcast"
        description="Pilih customer penerima broadcast Repeat Order lewat WhatsApp, tulis pesannya, lalu tekan Kirim Pesan."
      />
      <PageMessage />

      <Suspense fallback={<BroadcastSkeleton />}>
        <BroadcastContent />
      </Suspense>
    </>
  );
}

function BroadcastSkeleton() {
  return (
    <LoadingPage label="Memuat broadcast">
      <PageHeaderSkeleton />
      <div
        aria-hidden="true"
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:items-start"
      >
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <TableSkeleton columns={5} rows={8} columnWidths={["w-8", "w-40", "w-28", "w-32", "w-16"]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </LoadingPage>
  );
}
