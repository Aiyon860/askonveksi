"use client";

import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ALL_PAGE_SIZE, pageWindow, RECIPIENT_PAGE_SIZES } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** Paginasi untuk tabel yang datanya sudah diambil ke client (bukan lewat searchParams). */
export function RecipientPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = RECIPIENT_PAGE_SIZES,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}) {
  const sizeId = useId();
  const view = pageWindow(total, page, pageSize);

  if (total === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-xs text-muted-foreground">
        Menampilkan <strong className="font-medium text-foreground">{view.first}</strong> hingga{" "}
        <strong className="font-medium text-foreground">{view.last}</strong> dari{" "}
        <strong className="font-medium text-foreground">{total}</strong> data
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="whitespace-nowrap text-xs text-muted-foreground">
            Baris per halaman
          </label>
          <NativeSelect
            id={sizeId}
            size="sm"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))}
            aria-label="Jumlah baris per halaman"
          >
            {pageSizeOptions.map((size) => (
              <NativeSelectOption key={size} value={String(size)}>
                {size}
              </NativeSelectOption>
            ))}
            <NativeSelectOption key={ALL_PAGE_SIZE} value={String(ALL_PAGE_SIZE)}>
              Semuanya
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          Halaman <strong className="font-medium text-foreground">{view.page}</strong> /{" "}
          <strong className="font-medium text-foreground">{view.pageCount}</strong>
        </p>
        <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={view.page <= 1}
            onClick={() => onPageChange(view.page - 1)}
            aria-label="Ke halaman sebelumnya"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={view.page >= view.pageCount}
            onClick={() => onPageChange(view.page + 1)}
            aria-label="Ke halaman berikutnya"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
