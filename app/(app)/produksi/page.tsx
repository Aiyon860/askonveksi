import Link from "next/link";
import { Suspense } from "react";
import type { ProductionRoute } from "@prisma/client";

import { ProductionBoardSection } from "@/components/production/production-board-section";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { productionStages } from "@/lib/production/workflow";
import { cn } from "@/lib/utils";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ jalur?: string | string[] }>;
}) {
  const rawRoute = (await searchParams).jalur;
  const route: ProductionRoute = rawRoute === "NON_JERSEY" ? "NON_JERSEY" : "JERSEY";

  return (
    <>
      <PageHeader title="Produksi" description="Pantau setiap Sales Order dari tahap pertama sampai selesai." />
      <PageMessage />
      <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1" aria-label="Filter jalur produksi">
        <Button
          size="sm"
          variant={route === "JERSEY" ? "default" : "ghost"}
          render={<Link href="/produksi?jalur=JERSEY" />}
          nativeButton={false}
          aria-current={route === "JERSEY" ? "page" : undefined}
        >
          Jersey
        </Button>
        <Button
          size="sm"
          variant={route === "NON_JERSEY" ? "default" : "ghost"}
          render={<Link href="/produksi?jalur=NON_JERSEY" />}
          nativeButton={false}
          aria-current={route === "NON_JERSEY" ? "page" : undefined}
        >
          Non-Jersey
        </Button>
      </div>
      <Suspense fallback={<ProductionSkeleton route={route} />} key={route}>
        <ProductionBoardSection route={route} />
      </Suspense>
    </>
  );
}

function ProductionSkeleton({ route }: { route: ProductionRoute }) {
  const stages = productionStages(route);

  return (
    <div aria-hidden="true" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={`total-${index}`} className="flex min-h-26 flex-col gap-2 rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3",
          route === "JERSEY" ? "xl:grid-cols-7" : "xl:grid-cols-9",
        )}
      >
        {stages.map((stage) => (
          <div key={stage} className="flex min-h-26 flex-col gap-2 bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="grid auto-cols-[20rem] grid-flow-col gap-3 overflow-x-hidden pb-3">
        {stages.map((stage, column) => (
          <section key={`column-${stage}`} className="flex h-[clamp(24rem,calc(100svh-14rem),44rem)] flex-col overflow-hidden rounded-lg border bg-muted/30 p-2">
            <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-5" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <div className="flex flex-col gap-2">
              {Array.from({ length: column === 0 ? 2 : 1 }, (_, item) => (
                <div key={`column-${stage}-card-${item}`} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /></div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
