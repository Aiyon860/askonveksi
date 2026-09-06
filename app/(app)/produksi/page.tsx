import Link from "next/link";
import { Suspense } from "react";
import type { ProductionRoute } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductionBoardSection } from "@/components/production/production-board-section";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ jalur?: string | string[] }> }) {
  const rawRoute = (await searchParams).jalur;
  const route: ProductionRoute = rawRoute === "NON_JERSEY" ? "NON_JERSEY" : "JERSEY";

  return (
    <>
      <PageHeader title="Produksi" description="Pantau setiap Sales Order dari tahap pertama sampai selesai." />
      <PageMessage />
      <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1" aria-label="Filter jalur produksi">
        <Button size="sm" variant={route === "JERSEY" ? "default" : "ghost"} render={<Link href="/produksi?jalur=JERSEY" />} nativeButton={false} aria-current={route === "JERSEY" ? "page" : undefined}>Jersey</Button>
        <Button size="sm" variant={route === "NON_JERSEY" ? "default" : "ghost"} render={<Link href="/produksi?jalur=NON_JERSEY" />} nativeButton={false} aria-current={route === "NON_JERSEY" ? "page" : undefined}>Non-Jersey</Button>
      </div>
      <Suspense fallback={<ProductionSkeleton />} key={route}>
        <ProductionBoardSection route={route} />
      </Suspense>
    </>
  );
}

function ProductionSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
