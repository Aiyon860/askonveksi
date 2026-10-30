"use client";

import { useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, RotateCcw, Search, X } from "lucide-react";
import type { GarmentType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { GARMENT_TYPE_OPTIONS } from "@/lib/crm/constants";
import { NO_PRODUCT_CATEGORY, type PipelineFilters } from "@/lib/crm/pipeline-filters";
import { cn } from "@/lib/utils";

export type PipelineCustomerOption = { id: string; name: string; customerNo: string };
export type PipelineCategoryOption = { id: string; name: string; garmentType: GarmentType };

export function PipelineFiltersBar({
  filters,
  customers,
  categories,
  active,
  resetKey,
  onChange,
  onReset,
}: {
  filters: PipelineFilters;
  customers: PipelineCustomerOption[];
  categories: PipelineCategoryOption[];
  active: boolean;
  resetKey: number;
  onChange: (patch: Partial<PipelineFilters>) => void;
  onReset: () => void;
}) {
  const [monthFocused, setMonthFocused] = useState(false);
  const showMonthPlaceholder = !filters.month && !monthFocused;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Field className="gap-1.5 sm:max-w-sm sm:min-w-56 sm:flex-1">
        <FieldLabel htmlFor="pipeline-customer-filter">Cari customer</FieldLabel>
        {/*
          `key` memaksa combobox kembali ke keadaan kosong saat Reset ditekan.
          Nilainya tidak dikontrol supaya ketikan dan pilihan tetap ditangani Base UI.
        */}
        <Combobox.Root
          key={resetKey}
          items={customers}
          autoHighlight
          itemToStringLabel={(customer: PipelineCustomerOption) => customer.name}
          filter={(customer: PipelineCustomerOption, query) =>
            customer.name.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"))
          }
          onValueChange={(customer: PipelineCustomerOption | null) => onChange({ customerId: customer?.id ?? "" })}
        >
          <Combobox.InputGroup className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Combobox.Input
              id="pipeline-customer-filter"
              placeholder="Cari nama customer"
              className={cn(
                "h-9 w-full rounded-md border bg-card pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                filters.customerId ? "pr-16" : "pr-9",
              )}
            />
            <Combobox.Clear
              className="absolute top-0 right-9 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Hapus pilihan customer"
            >
              <X aria-hidden="true" className="size-4" />
            </Combobox.Clear>
            <Combobox.Trigger
              className="absolute top-0 right-0 flex size-9 items-center justify-center text-muted-foreground"
              aria-label="Buka pilihan customer"
            >
              <ChevronsUpDown aria-hidden="true" className="size-4" />
            </Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner className="z-60 outline-none" sideOffset={4}>
              <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
                  Customer tidak ditemukan.
                </Combobox.Empty>
                <Combobox.List className="max-h-[min(20rem,var(--available-height))] w-full overflow-y-auto overscroll-contain outline-none">
                  {(customer: PipelineCustomerOption) => (
                    <Combobox.Item
                      key={customer.id}
                      value={customer}
                      className="flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                      style={{ display: "flex", width: "100%" }}
                    >
                      <Combobox.ItemIndicator className="shrink-0">
                        <Check aria-hidden="true" className="size-4" />
                      </Combobox.ItemIndicator>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate leading-5 font-medium">{customer.name}</span>
                        <span className="block font-mono text-xs leading-5 text-muted-foreground">
                          {customer.customerNo}
                        </span>
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
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
