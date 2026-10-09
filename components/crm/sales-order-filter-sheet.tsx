"use client";

import { ListFilter } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SalesOrderInvoicePaymentFilter, SalesOrderListSort, SalesOrderListStatus, SalesOrderWoFilter, SortDirection } from "@/lib/crm/data";

type SalesOrderFilterSheetProps = {
  query: string;
  status: SalesOrderListStatus;
  invoicePayment: SalesOrderInvoicePaymentFilter;
  woStatus: SalesOrderWoFilter;
  from: string;
  to: string;
  today: string;
  pageSize?: string;
  sort?: SalesOrderListSort;
  order?: SortDirection;
  activeFilterCount: number;
  activeSummary: string;
};

export function SalesOrderFilterSheet({
  query,
  status,
  invoicePayment,
  woStatus,
  from,
  to,
  today,
  pageSize,
  sort,
  order,
  activeFilterCount,
  activeSummary,
}: SalesOrderFilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const nextStatus = String(formData.get("status") ?? "all");
    const nextInvoicePayment = String(formData.get("inv") ?? "all");
    const nextWoStatus = String(formData.get("wo") ?? "all");
    const nextFrom = String(formData.get("from") ?? "");
    const nextTo = String(formData.get("to") ?? "");

    if (query) params.set("q", query);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextInvoicePayment !== "all") params.set("inv", nextInvoicePayment);
    if (nextWoStatus !== "all") params.set("wo", nextWoStatus);
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);
    if (pageSize) params.set("pageSize", pageSize);

    const nextQuery = params.toString();
    router.push(nextQuery ? `/crm/sales-orders?${nextQuery}` : "/crm/sales-orders", { scroll: false });
    setOpen(false);
  }

  function handleReset() {
    router.push("/crm/sales-orders", { scroll: false });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between sm:w-auto"
            aria-label={`Buka filter Sales Order: ${activeSummary}`}
          />
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <ListFilter data-icon="inline-start" aria-hidden="true" />
          Filter
        </span>
        {activeFilterCount ? (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {activeFilterCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,calc(100%-1rem))] gap-0 p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Filter Sales Order</SheetTitle>
            <SheetDescription>{activeSummary}</SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {query ? <input type="hidden" name="q" value={query} /> : null}
            {pageSize ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
            {sort ? <input type="hidden" name="sort" value={sort} /> : null}
            {order ? <input type="hidden" name="order" value={order} /> : null}
            <FieldGroup className="gap-5">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="so-status">Status SO</FieldLabel>
                <NativeSelect id="so-status" name="status" defaultValue={status} className="w-full">
                  <NativeSelectOption value="all">Semua status SO</NativeSelectOption>
                  <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
                  <NativeSelectOption value="CANCELLED">Dibatalkan</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="so-invoice-payment">Status Invoice</FieldLabel>
                <NativeSelect id="so-invoice-payment" name="inv" defaultValue={invoicePayment} className="w-full">
                  <NativeSelectOption value="all">Semua status invoice</NativeSelectOption>
                  <NativeSelectOption value="PAID">Lunas</NativeSelectOption>
                  <NativeSelectOption value="UNPAID">Belum Lunas</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="so-wo">Status WO</FieldLabel>
                <NativeSelect id="so-wo" name="wo" defaultValue={woStatus} className="w-full">
                  <NativeSelectOption value="all">Semua status WO</NativeSelectOption>
                  <NativeSelectOption value="DONE">Selesai</NativeSelectOption>
                  <NativeSelectOption value="ONGOING">Belum Selesai</NativeSelectOption>
                  <NativeSelectOption value="NONE">Belum ada WO</NativeSelectOption>
                </NativeSelect>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="so-from">Dari tanggal</FieldLabel>
                  <Input key={from} id="so-from" name="from" type="date" max={today} defaultValue={from} />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="so-to">Sampai tanggal</FieldLabel>
                  <Input key={to} id="so-to" name="to" type="date" max={today} defaultValue={to} />
                </Field>
              </div>
            </FieldGroup>
          </div>
          <Separator />
          <SheetFooter className="sm:grid sm:grid-cols-2">
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset
            </Button>
            <Button type="submit">Terapkan</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
