"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductionSummary } from "@/components/production/production-summary";
import type { ProductionRoute } from "@prisma/client";
import type { getProductionBoard } from "@/lib/production/data";

const ProductionBoard = dynamic(
  () => import("@/components/production/production-board").then((m) => ({ default: m.ProductionBoard })),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

type ProductionData = Awaited<ReturnType<typeof getProductionBoard>>;

export function ProductionBoardSectionClient({
  route,
  initialData,
}: {
  route: ProductionRoute;
  initialData: ProductionData;
}) {
  const { data, mutate } = useSWR<ProductionData>(`/api/produksi/board?jalur=${route}`, fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
    dedupingInterval: 10000,
  });

  // Data server (RSC) selalu paling baru setelah aksi + `router.refresh()`. Tanpa ini, cache SWR
  // menahan snapshot lama (mis. Kendala yang baru disimpan hilang saat kartu dipindah antar kolom).
  useEffect(() => {
    void mutate(initialData, { revalidate: false });
  }, [initialData, mutate]);

  const board = data ?? initialData;

  return (
    <>
      <ProductionSummary route={route} items={board.items} total={board.total} />

      {board.truncated ? (
        <Alert>
          <AlertTitle>Board menampilkan 500 Work Order terbaru</AlertTitle>
          <AlertDescription>Total {board.total} Work Order pada jalur ini. Buka Sales Order terkait untuk menelusuri data lama.</AlertDescription>
        </Alert>
      ) : null}

      <ProductionBoard route={route} items={board.items} />
    </>
  );
}
