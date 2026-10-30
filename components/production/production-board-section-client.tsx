"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { ListFilter, RotateCcw } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductionSummary } from "@/components/production/production-summary";
import type { ProductionPicOption } from "@/components/production/production-filters";
import {
  EMPTY_PRODUCTION_BOARD_FILTERS,
  NO_PIC,
  activeProductionBoardFilterLabels,
  hasActiveProductionBoardFilters,
  productionBoardFilterParams,
  type ProductionBoardFilters,
} from "@/lib/production/board-filters";
import type { ProductionBoardGroup } from "@/lib/production/workflow";
import type { getProductionBoard } from "@/lib/production/data";

const ProductionBoard = dynamic(
  () => import("@/components/production/production-board").then((m) => ({ default: m.ProductionBoard })),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

type ProductionData = Awaited<ReturnType<typeof getProductionBoard>>;

export function ProductionBoardSectionClient({
  group,
  productCategoryId,
  filters = EMPTY_PRODUCTION_BOARD_FILTERS,
  picOptions = [],
  initialData,
}: {
  group: ProductionBoardGroup;
  productCategoryId: string | null;
  filters?: ProductionBoardFilters;
  picOptions?: ProductionPicOption[];
  initialData: ProductionData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Polling 60 detik wajib memakai filter yang sama dengan halaman; tanpa ini
  // kartu hasil filter muncul kembali sendiri setiap menit.
  const filterQuery = new URLSearchParams(productionBoardFilterParams(filters)).toString();
  const { data, mutate } = useSWR<ProductionData>(
    `/api/produksi/board?jalur=${group}&kategori=${productCategoryId ?? ""}${filterQuery ? `&${filterQuery}` : ""}`,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60000,
      dedupingInterval: 10000,
    },
  );

  // Data server (RSC) selalu paling baru setelah aksi + `router.refresh()`. Tanpa ini, cache SWR
  // menahan snapshot lama (mis. Kendala yang baru disimpan hilang saat kartu dipindah antar kolom).
  useEffect(() => {
    void mutate(initialData, { revalidate: false });
  }, [initialData, mutate]);

  const board = data ?? initialData;
  const isFiltering = hasActiveProductionBoardFilters(filters);
  const selectedPic = filters.pic === NO_PIC ? null : picOptions.find((option) => option.id === filters.pic)?.name ?? null;
  const activeFilterLabels = activeProductionBoardFilterLabels(filters, selectedPic);

  function resetFilters() {
    const params = new URLSearchParams({ jalur: group, ...(productCategoryId ? { kategori: productCategoryId } : {}) });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <ProductionSummary group={group} items={board.items} total={board.total} />

      {board.canManage === false ? (
        <Alert>
          <AlertTitle>Mode lihat saja</AlertTitle>
          <AlertDescription>Anda dapat memantau progres produksi, tetapi memindahkan tahap dan mengubah kendala hanya dapat dilakukan tim Produksi.</AlertDescription>
        </Alert>
      ) : null}

      {board.truncated ? (
        <Alert>
          <AlertTitle>Board menampilkan 500 Work Order terbaru</AlertTitle>
          <AlertDescription>
            {isFiltering ? "Filter berlaku untuk seluruh Work Order, sedangkan board hanya memuat 500 kartu terbaru. " : null}
            Total {board.total} Work Order pada filter ini. Buka Sales Order terkait untuk menelusuri data lama.
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {isFiltering ? `${board.total} Work Order ditampilkan pada filter aktif.` : ""}
      </p>

      {isFiltering && board.items.length === 0 ? (
        <Empty className="border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListFilter aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Tidak ada Work Order yang cocok</EmptyTitle>
            <EmptyDescription>
              {activeFilterLabels.length
                ? `Tidak ada Work Order untuk ${activeFilterLabels.join(" · ")}. Hapus salah satu filter atau reset untuk melihat pekerjaan lain.`
                : "Ubah atau hapus filter untuk melihat pekerjaan lain."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Reset filter
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ProductionBoard group={group} items={board.items} canManage={board.canManage !== false} onRefresh={() => mutate()} />
      )}
    </>
  );
}
