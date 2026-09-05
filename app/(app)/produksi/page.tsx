import Link from "next/link";
import type { ProductionRoute } from "@prisma/client";

import { LegacyProductionSetup } from "@/components/production/legacy-production-setup";
import { ProductionBoard } from "@/components/production/production-board";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProductionBoard } from "@/lib/production/data";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ jalur?: string | string[] }> }) {
  const rawRoute = (await searchParams).jalur;
  const route: ProductionRoute = rawRoute === "NON_JERSEY" ? "NON_JERSEY" : "JERSEY";
  const { items, total, truncated, legacyOrders } = await getProductionBoard(route);

  return (
    <>
      <PageHeader title="Produksi" description="Pantau setiap Sales Order dari tahap pertama sampai selesai." />
      <PageMessage />
      <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1" aria-label="Filter jalur produksi">
        <Button size="sm" variant={route === "JERSEY" ? "default" : "ghost"} render={<Link href="/produksi?jalur=JERSEY" />} nativeButton={false} aria-current={route === "JERSEY" ? "page" : undefined}>Jersey</Button>
        <Button size="sm" variant={route === "NON_JERSEY" ? "default" : "ghost"} render={<Link href="/produksi?jalur=NON_JERSEY" />} nativeButton={false} aria-current={route === "NON_JERSEY" ? "page" : undefined}>Non-Jersey</Button>
      </div>
      <LegacyProductionSetup orders={legacyOrders} />
      {truncated ? <Alert><AlertTitle>Board menampilkan 500 Work Order terbaru</AlertTitle><AlertDescription>Total {total} Work Order pada jalur ini. Buka Sales Order terkait untuk menelusuri data lama.</AlertDescription></Alert> : null}
      <ProductionBoard route={route} items={items} />
    </>
  );
}
