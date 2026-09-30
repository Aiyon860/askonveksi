import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Check, ChevronDown, ListFilter, MessageSquareText } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewTemplateDialog, TemplateRowWithDialog } from "@/components/whatsapp/template-dialogs";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { WHATSAPP_TRIGGER_LABELS } from "@/lib/whatsapp/core";
import {
  getWhatsAppTemplates,
  type WhatsAppTemplateStatusFilter,
  type WhatsAppTemplateTriggerFilter,
} from "@/lib/whatsapp/data";
import type { SortDirection } from "@/lib/crm/data";
import type { WhatsAppTemplateSort } from "@/lib/whatsapp/data";

const TEMPLATE_TRIGGERS = ["all", "MANUAL", "NEXT_ACTION", "REACTIVATION", "INVOICE_ISSUED", "INVOICE_DUE"] as const satisfies readonly WhatsAppTemplateTriggerFilter[];
const TEMPLATE_STATUSES = ["all", "active", "inactive"] as const satisfies readonly WhatsAppTemplateStatusFilter[];
const TEMPLATE_SORTS = ["name", "triggerType", "isActive", "updatedAt"] as const satisfies readonly WhatsAppTemplateSort[];
const SORT_DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type TemplateSearchParams = Promise<{
  q?: string | string[];
  trigger?: string | string[];
  status?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  sort?: string | string[];
  order?: string | string[];
}>;

type TemplateTableState = {
  query: string;
  trigger: WhatsAppTemplateTriggerFilter;
  status: WhatsAppTemplateStatusFilter;
  page: number;
  pageSize: number;
  sort: WhatsAppTemplateSort;
  direction: SortDirection;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultDirection(sort: WhatsAppTemplateSort): SortDirection {
  return sort === "updatedAt" ? "desc" : "asc";
}

function parseTrigger(value: string | string[] | undefined): WhatsAppTemplateTriggerFilter {
  const raw = firstParam(value);
  return TEMPLATE_TRIGGERS.find((item) => item === raw) ?? "all";
}

function parseStatus(value: string | string[] | undefined): WhatsAppTemplateStatusFilter {
  const raw = firstParam(value);
  return TEMPLATE_STATUSES.find((item) => item === raw) ?? "all";
}

function parseSort(value: string | string[] | undefined): WhatsAppTemplateSort {
  const raw = firstParam(value);
  return TEMPLATE_SORTS.find((item) => item === raw) ?? "updatedAt";
}

function parseDirection(value: string | string[] | undefined, sort: WhatsAppTemplateSort): SortDirection {
  const raw = firstParam(value);
  return SORT_DIRECTIONS.find((item) => item === raw) ?? defaultDirection(sort);
}

function templatesHref(state: TemplateTableState, changes: Partial<TemplateTableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.trigger !== "all") params.set("trigger", next.trigger);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "updatedAt") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/master-data/whatsapp/templates?${query}` : "/master-data/whatsapp/templates";
}

function sortHref(state: TemplateTableState, sort: WhatsAppTemplateSort) {
  const direction = state.sort === sort
    ? state.direction === "asc" ? "desc" : "asc"
    : defaultDirection(sort);
  return templatesHref(state, { sort, direction, page: 1 });
}

function TemplatesTableFallback() {
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
      role="status"
      aria-live="polite"
      aria-label="Memuat daftar template"
    >
      <span className="sr-only">Memuat daftar template...</span>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" aria-hidden="true">
        <div className="flex min-w-0 flex-1 gap-2">
          <Skeleton className="h-9 w-full sm:max-w-md" />
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="min-h-112" aria-hidden="true">
        <TableSkeleton columns={7} rows={8} className="min-w-5xl" />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
    </section>
  );
}

async function TemplatesTableSection({ searchParams }: { searchParams: TemplateSearchParams }) {
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim().slice(0, 120);
  const trigger = parseTrigger(params.trigger);
  const status = parseStatus(params.status);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = parseSort(params.sort);
  const direction = parseDirection(params.order, sort);
  const state = { query, trigger, status, page, pageSize, sort, direction } satisfies TemplateTableState;

  const { items: templates, total, pageCount } = await getWhatsAppTemplates(state);

  if (page > pageCount) redirect(templatesHref(state, { page: pageCount }));

  const persistentParams = {
    q: query || undefined,
    trigger: trigger !== "all" ? trigger : undefined,
    status: status !== "all" ? status : undefined,
    sort: sort !== "updatedAt" ? sort : undefined,
    order: direction !== defaultDirection(sort) ? direction : undefined,
    pageSize: pageSize !== DATA_PAGE_SIZE ? String(pageSize) : undefined,
  };
  const activeFilterCount = Number(trigger !== "all") + Number(status !== "all");

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar template pesan">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <DebouncedSearchInput
            key={query}
            initialValue={query}
            pathname="/master-data/whatsapp/templates"
            params={persistentParams}
            placeholder="Cari nama atau isi pesan..."
            ariaLabel="Cari template"
            className="sm:max-w-md"
            maxLength={120}
          />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <ListFilter data-icon="inline-start" aria-hidden="true" />
              {activeFilterCount ? `Filter · ${activeFilterCount}` : "Filter"}
              <ChevronDown data-icon="inline-end" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Pemicu</DropdownMenuLabel>
                <DropdownMenuItem render={<Link href={templatesHref(state, { trigger: "all", page: 1 })} />}>
                  <Check className={cn(trigger !== "all" && "opacity-0")} aria-hidden="true" />
                  Semua pemicu
                </DropdownMenuItem>
                {TEMPLATE_TRIGGERS.filter((item) => item !== "all").map((item) => (
                  <DropdownMenuItem
                    key={item}
                    render={<Link href={templatesHref(state, { trigger: item, page: 1 })} />}
                  >
                    <Check className={cn(trigger !== item && "opacity-0")} aria-hidden="true" />
                    {WHATSAPP_TRIGGER_LABELS[item]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {TEMPLATE_STATUSES.map((item) => (
                  <DropdownMenuItem
                    key={item}
                    render={<Link href={templatesHref(state, { status: item, page: 1 })} />}
                  >
                    <Check className={cn(status !== item && "opacity-0")} aria-hidden="true" />
                    {item === "all" ? "Semua status" : item === "active" ? "Aktif" : "Nonaktif"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">{total}</strong> template ditemukan
          </p>
          <NewTemplateDialog />
        </div>
      </div>

      {templates.length ? (
        <div className="flex min-h-112 flex-1 flex-col">
          <Table className="min-w-6xl" containerClassName="min-h-0 flex-1 overflow-auto">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow className="hover:bg-muted">
                <TableHead className="w-16 text-center">No</TableHead>
                <SortableTableHead label="Nama" href={sortHref(state, "name")} active={sort === "name"} direction={direction} className="min-w-48" />
                <SortableTableHead label="Pemicu" href={sortHref(state, "triggerType")} active={sort === "triggerType"} direction={direction} />
                <SortableTableHead label="Aktif" href={sortHref(state, "isActive")} active={sort === "isActive"} direction={direction} className="w-24" />
                <SortableTableHead label="Diperbarui" href={sortHref(state, "updatedAt")} active={sort === "updatedAt"} direction={direction} />
                <TableHead className="min-w-72">Isi pesan</TableHead>
                <TableHead className="w-44 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template, index) => (
                <TemplateRowWithDialog
                  key={template.id}
                  number={(page - 1) * pageSize + index + 1}
                  template={{ ...template, updatedAt: template.updatedAt.toISOString() }}
                />
              ))}
            </TableBody>
          </Table>
          <DataPagination
            pathname="/master-data/whatsapp/templates"
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={DATA_PAGE_SIZES}
            params={persistentParams}
            className="border-t px-4 py-3"
          />
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MessageSquareText aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>Template tidak ditemukan</EmptyTitle>
            <EmptyDescription>Coba kata kunci lain, ubah filter, atau tambah template baru.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}

export default function WhatsAppTemplatesPage({ searchParams }: { searchParams: TemplateSearchParams }) {
  return (
    <>
      <PageHeader title="Template Pesan WhatsApp" description="Kelola pesan cepat dan pesan otomatis WhatsApp. Klik baris untuk melihat detail." />
      <PageMessage />
      <Suspense fallback={<TemplatesTableFallback />}>
        <TemplatesTableSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}
