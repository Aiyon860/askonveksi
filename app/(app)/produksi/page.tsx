import Link from "next/link";
import { Suspense } from "react";
import type { ProductionRoute } from "@prisma/client";

import { ProductionBoardSection } from "@/components/production/production-board-section";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveProductCategories } from "@/lib/master-data";
import {
  parseProductionBoardGroup,
  productionStages,
  PRODUCTION_BOARD_GROUPS,
  PRODUCTION_BOARD_GROUP_LABEL,
  stageRouteForGroup,
  type ProductionBoardGroup,
} from "@/lib/production/workflow";
import { cn } from "@/lib/utils";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ jalur?: string | string[]; kategori?: string | string[] }>;
}) {
  const params = await searchParams;
  const group = parseProductionBoardGroup(params.jalur);
  const stageRoute = stageRouteForGroup(group);

  // Filter tingkat kedua: kategori produk aktif per grup, urut Jersey > Non-jersey > Aksesoris.
  const activeCategories = await getActiveProductCategories();
  const categoriesByGroup: Record<ProductionBoardGroup, { id: string; name: string }[]> = {
    JERSEY: [],
    NON_JERSEY: [],
    AKSESORI: [],
  };
  for (const category of activeCategories) categoriesByGroup[category.garmentType].push({ id: category.id, name: category.name });

  const categories = categoriesByGroup[group];
  const rawKategori = Array.isArray(params.kategori) ? params.kategori[0] : params.kategori;
  const kategoriId = categories.some((category) => category.id === rawKategori)
    ? (rawKategori ?? null)
    : categories[0]?.id ?? null;

  function groupHref(target: ProductionBoardGroup) {
    const firstId = categoriesByGroup[target][0]?.id;
    return firstId ? `/produksi?jalur=${target}&kategori=${firstId}` : `/produksi?jalur=${target}`;
  }

  return (
    <>
      <PageHeader title="Produksi" description="Pantau setiap Sales Order dari tahap pertama sampai selesai." />
      <PageMessage />
      <div className="flex flex-col gap-3">
        <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1" aria-label="Filter jalur produksi">
          {PRODUCTION_BOARD_GROUPS.map((target) => (
            <Button
              key={target}
              size="sm"
              variant={group === target ? "default" : "ghost"}
              render={<Link href={groupHref(target)} />}
              nativeButton={false}
              aria-current={group === target ? "page" : undefined}
            >
              {PRODUCTION_BOARD_GROUP_LABEL[target]}
            </Button>
          ))}
        </div>
        {categories.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Filter kategori produk">
            {categories.map((category) => (
              <Button
                key={category.id}
                size="sm"
                variant={kategoriId === category.id ? "default" : "outline"}
                render={<Link href={`/produksi?jalur=${group}&kategori=${category.id}`} />}
                nativeButton={false}
                aria-current={kategoriId === category.id ? "true" : undefined}
              >
                {category.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <Suspense fallback={<ProductionSkeleton route={stageRoute} />} key={`${group}:${kategoriId ?? ""}`}>
        <ProductionBoardSection group={group} productCategoryId={kategoriId} />
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
