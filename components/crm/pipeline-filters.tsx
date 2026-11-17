"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import type { GarmentType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { GARMENT_TYPE_OPTIONS } from "@/lib/crm/constants";
import { NO_PRODUCT_CATEGORY, type PipelineFilters } from "@/lib/crm/pipeline-filters";
import { cn } from "@/lib/utils";

export type PipelineCategoryOption = { id: string; name: string; garmentType: GarmentType };

export function PipelineFiltersBar({
  filters,
  categories,
  active,
  onChange,
  onReset,
}: {
  filters: PipelineFilters;
  categories: PipelineCategoryOption[];
  active: boolean;
  onChange: (patch: Partial<PipelineFilters>) => void;
  onReset: () => void;
}) {
  const [monthFocused, setMonthFocused] = useState(false);
  const showMonthPlaceholder = !filters.month && !monthFocused;
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K memfokuskan pencarian dari mana pun di halaman papan.
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Field className="gap-1.5 sm:max-w-sm sm:min-w-56 sm:flex-1">
        <FieldLabel htmlFor="pipeline-search-filter">Cari</FieldLabel>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            id="pipeline-search-filter"
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Customer, kode peluang, PO, invoice"
            aria-keyshortcuts="Control+K"
            className={cn("bg-card pl-9", filters.query ? "pr-20" : "pr-16")}
          />
          {filters.query ? (
            <button
              type="button"
              onClick={() => onChange({ query: "" })}
              aria-label="Hapus pencarian"
              className="absolute inset-y-0 right-14 flex w-5 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-2 my-auto hidden h-6 items-center rounded border bg-muted px-1.5 font-mono text-[0.65rem] font-semibold text-muted-foreground sm:flex"
          >
            Ctrl K
          </kbd>
        </div>
      </Field>

      <Field className="gap-1.5 sm:w-44">
        <FieldLabel htmlFor="pipeline-month-filter">Bulan dibuat</FieldLabel>
        <div className="relative">
          <Input
            id="pipeline-month-filter"
            type="month"
            lang="id-ID"
            value={filters.month}
            onChange={(event) => onChange({ month: event.target.value })}
            onFocus={() => setMonthFocused(true)}
            onBlur={() => setMonthFocused(false)}
            aria-label="Filter bulan peluang dibuat, kosong berarti semua bulan"
            className={cn(showMonthPlaceholder && "text-transparent")}
          />
          {showMonthPlaceholder ? (
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
              Semua bulan
            </span>
          ) : null}
        </div>
      </Field>

      <Field className="gap-1.5 sm:w-56">
        <FieldLabel htmlFor="pipeline-category-filter">Kategori produk</FieldLabel>
        <NativeSelect
          id="pipeline-category-filter"
          value={filters.categoryId}
          onChange={(event) => onChange({ categoryId: event.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="">Semua kategori produk</NativeSelectOption>
          {GARMENT_TYPE_OPTIONS.map(({ value: garmentType, label }) => {
            const group = categories.filter((category) => category.garmentType === garmentType);
            if (!group.length) return null;
            return (
              <NativeSelectOptGroup key={garmentType} label={label}>
                {group.map((category) => (
                  <NativeSelectOption key={category.id} value={category.id}>
                    {category.name}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            );
          })}
          <NativeSelectOption value={NO_PRODUCT_CATEGORY}>Tanpa kategori</NativeSelectOption>
        </NativeSelect>
      </Field>

      {active ? (
        <Button type="button" variant="ghost" onClick={onReset} className="self-start sm:self-end">
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
