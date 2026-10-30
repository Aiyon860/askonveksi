"use client";

import { usePathname, useRouter } from "next/navigation";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RotateCcw } from "lucide-react";

import {
  DEADLINE_PRESETS,
  EMPTY_PRODUCTION_BOARD_FILTERS,
  NO_PIC,
  PENANDA_OPTIONS,
  PRODUCTION_BOARD_PATH,
  STATUS_OPTIONS,
  hasActiveProductionBoardFilters,
  productionBoardFilterParams,
  type ProductionBoardFilters,
  type ProductionPenanda,
} from "@/lib/production/board-filters";
import type { ProductionBoardGroup } from "@/lib/production/workflow";
import { cn } from "@/lib/utils";

export type ProductionPicOption = { id: string; name: string };

/**
 * Bar filter papan Produksi. Filter hidup di URL supaya terbawa saat pindah
 * Jalur/Kategori, bisa dibagikan lewat tautan, dan dipakai tombol Export.
 */
export function ProductionFiltersBar({
  group,
  productCategoryId,
  filters,
  picOptions,
}: {
  group: ProductionBoardGroup;
  productCategoryId: string | null;
  filters: ProductionBoardFilters;
  picOptions: ProductionPicOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Parameter halaman yang harus selalu ikut: jalur + kategori aktif.
  const baseParams = { jalur: group, ...(productCategoryId ? { kategori: productCategoryId } : {}) };
  const active = hasActiveProductionBoardFilters(filters);

  function navigate(next: ProductionBoardFilters) {
    const params = new URLSearchParams({ ...baseParams, ...productionBoardFilterParams(next) });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function patch(next: Partial<ProductionBoardFilters>) {
    navigate({ ...filters, ...next });
  }

  function togglePenanda(value: ProductionPenanda) {
    const selected = filters.penanda.includes(value)
      ? filters.penanda.filter((item) => item !== value)
      : [...filters.penanda, value];
    // Urutan tetap mengikuti opsi, bukan urutan klik, agar URL stabil.
    patch({ penanda: PENANDA_OPTIONS.map((option) => option.value).filter((item) => selected.includes(item)) });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" aria-label="Filter papan produksi">
      <Field className="gap-1.5 sm:min-w-64 sm:flex-1">
        <FieldLabel htmlFor="production-filter-search">Cari</FieldLabel>
        {/*
          Pencarian memakai input debounce yang sudah dipakai daftar lain:
          seluruh filter lain dipertahankan, hanya `q` yang berubah.
        */}
        <DebouncedSearchInput
          id="production-filter-search"
          initialValue={filters.q}
          pathname={PRODUCTION_BOARD_PATH}
          params={{ ...baseParams, ...productionBoardFilterParams({ ...filters, q: "" }) }}
          placeholder="Nomor WO, produk, SO, atau customer"
          ariaLabel="Cari Work Order, produk, Sales Order, atau customer"
        />
      </Field>

      <Field className="gap-1.5 sm:w-56">
        <FieldLabel htmlFor="production-filter-pic">PIC</FieldLabel>
        <NativeSelect
          id="production-filter-pic"
          value={filters.pic}
          onChange={(event) => patch({ pic: event.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="">Semua PIC</NativeSelectOption>
          {picOptions.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value={NO_PIC}>Belum ada PIC</NativeSelectOption>
        </NativeSelect>
      </Field>

      <Field className="gap-1.5 sm:w-52">
        <FieldLabel htmlFor="production-filter-deadline">Deadline</FieldLabel>
        <NativeSelect
          id="production-filter-deadline"
          value={filters.deadline}
          onChange={(event) => patch({ deadline: event.target.value as ProductionBoardFilters["deadline"] })}
          className="w-full"
        >
          <NativeSelectOption value="">Semua deadline</NativeSelectOption>
          {DEADLINE_PRESETS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field className="gap-1.5 sm:w-40">
        <FieldLabel htmlFor="production-filter-status">Status</FieldLabel>
        <NativeSelect
          id="production-filter-status"
          value={filters.status}
          onChange={(event) => patch({ status: event.target.value as ProductionBoardFilters["status"] })}
          className="w-full"
        >
          <NativeSelectOption value="">Semua status</NativeSelectOption>
          {STATUS_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Filter penanda kartu">
        {PENANDA_OPTIONS.map((option) => {
          const selected = filters.penanda.includes(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => togglePenanda(option.value)}
              className="shrink-0"
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(EMPTY_PRODUCTION_BOARD_FILTERS)}
          className={cn("self-start sm:self-end")}
        >
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
