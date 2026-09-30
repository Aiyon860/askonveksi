import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PurchaseOrderDetail } from "@/components/crm/purchase-order-detail";
import { PurchaseOrderFilterSheet } from "@/components/crm/purchase-order-filter-sheet";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FilterBarSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { DocumentPrintButton } from "@/components/crm/document-print-button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseDocumentDateRange } from "@/lib/crm/document-list-filters";
import { formatDate } from "@/lib/crm/format";
import { getPurchaseOrders, type PurchaseOrderListSort, type PurchaseOrderListStatus, type SortDirection } from "@/lib/crm/data";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const SORTS = ["purchaseOrderNo", "productName", "customer", "status", "createdAt", "deadline"] as const satisfies readonly PurchaseOrderListSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type TableState = {
  query: string;
  status: PurchaseOrderListStatus;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sort: PurchaseOrderListSort;
  direction: SortDirection;
};

function defaultDirection(sort: PurchaseOrderListSort): SortDirection {
  return sort === "createdAt" ? "desc" : "asc";
}

function tableHref(state: TableState, changes: Partial<TableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.status !== "all") params.set("status", next.status);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.sort !== "createdAt") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/crm/purchase-orders?${query}` : "/crm/purchase-orders";
}

function sortHref(state: TableState, sort: PurchaseOrderListSort) {
  const direction = state.sort === sort
    ? state.direction === "asc" ? "desc" : "asc"
    : defaultDirection(sort);
  return tableHref(state, { sort, direction, page: 1 });
}

function purchaseOrderStatusLabel(status: PurchaseOrderListStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "AGREED") return "Disepakati";
  if (status === "SUPERSEDED") return "Digantikan";
  if (status === "CANCELLED") return "Dibatalkan";
  return null;
}

async function PurchaseOrdersTableSection({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status: PurchaseOrderListStatus = rawStatus === "DRAFT" || rawStatus === "AGREED" || rawStatus === "SUPERSEDED" || rawStatus === "CANCELLED" ? rawStatus : "all";
  const range = parseDocumentDateRange(params.from, params.to);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const rawSort = first(params.sort);
  const sort = SORTS.find((item) => item === rawSort) ?? "createdAt";
  const rawDirection = first(params.order);
  const direction = DIRECTIONS.find((item) => item === rawDirection) ?? defaultDirection(sort);
  const state = { query, status, from: range.from, to: range.to, page, pageSize, sort, direction } satisfies TableState;
  const { items, total, pageCount } = await getPurchaseOrders({ query, status, start: range.start, end: range.end, page, pageSize, sort, direction });
  const persistent = {
    q: query || undefined,
    status: status === "all" ? undefined : status,
    from: range.from || undefined,
    to: range.to || undefined,
    sort: sort === "createdAt" ? undefined : sort,
    order: direction === defaultDirection(sort) ? undefined : direction,
    pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize),
  };
  if (page > pageCount) redirect(tableHref(state, { page: pageCount }));
  const hasFilters = Boolean(query || status !== "all" || range.start);
  const filterSummaryParts = [
    purchaseOrderStatusLabel(status),
    range.from && range.to ? `${range.from} s.d. ${range.to}` : range.from ? `Mulai ${range.from}` : range.to ? `Sampai ${range.to}` : null,
  ].filter(Boolean);
  const activeFilterCount = Number(status !== "all") + Number(Boolean(range.start));
  const activeSummary = filterSummaryParts.length ? filterSummaryParts.join(" · ") : "Semua purchase order";

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar purchase order">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/purchase-orders" params={persistent} placeholder="Cari no. PO, produk, atau customer..." ariaLabel="Cari purchase order" className="w-full lg:max-w-xl" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:ml-auto lg:justify-end">
        <p className="text-xs text-muted-foreground lg:whitespace-nowrap"><strong className="font-medium text-foreground">{total}</strong> purchase order</p>
        <div className="flex items-center gap-2">
          {filterSummaryParts.length ? <p className="hidden max-w-80 truncate text-xs text-muted-foreground xl:block">{activeSummary}</p> : null}
          <PurchaseOrderFilterSheet
            query={query}
            status={status}
            from={range.from}
            to={range.to}
            today={range.today}
            pageSize={pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize)}
            sort={sort === "createdAt" ? undefined : sort}
            order={direction === defaultDirection(sort) ? undefined : direction}
            activeFilterCount={activeFilterCount}
            activeSummary={activeSummary}
          />
        </div>
      </div>
    </div>
    {items.length ? <div className="flex min-h-112 flex-1 flex-col">
      <Table className="min-w-4xl" containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="No. PO" href={sortHref(state, "purchaseOrderNo")} active={sort === "purchaseOrderNo"} direction={direction} /><SortableTableHead label="Jenis pakaian" href={sortHref(state, "productName")} active={sort === "productName"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} /><SortableTableHead label="Status" href={sortHref(state, "status")} active={sort === "status"} direction={direction} /><SortableTableHead label="Tanggal dibuat" href={sortHref(state, "createdAt")} active={sort === "createdAt"} direction={direction} /><SortableTableHead label="Deadline produksi" href={sortHref(state, "deadline")} active={sort === "deadline"} direction={direction} /><TableHead className="w-14 text-center"><span className="sr-only">Print</span></TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item, index) => <PurchaseOrderDetail key={item.id} id={item.id}>
          <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono">{item.purchaseOrderNo}</TableCell><TableCell>{item.productName}</TableCell><TableCell>{item.opportunity.customer.name}</TableCell><TableCell><PurchaseOrderStatusBadge status={item.status} /></TableCell><TableCell>{formatDate(item.createdAt)}</TableCell><TableCell>{formatDate(item.deadline)}</TableCell><TableCell className="text-center"><DocumentPrintButton href={`/api/crm/purchase-order/${item.id}/pdf`} label={`Print ${item.purchaseOrderNo}`} /></TableCell>
        </PurchaseOrderDetail>)}</TableBody>
      </Table>
      <DataPagination pathname="/crm/purchase-orders" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
    </div> : <Empty><EmptyHeader><EmptyMedia variant="icon"><FileText aria-hidden="true" /></EmptyMedia><EmptyTitle>{hasFilters ? "Purchase order tidak ditemukan" : "Belum ada purchase order"}</EmptyTitle><EmptyDescription>{hasFilters ? "Coba ubah kata kunci atau filter yang digunakan." : "Purchase order yang dibuat dari CRM akan muncul di sini."}</EmptyDescription></EmptyHeader></Empty>}
  </section>;
}

export default function PurchaseOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Purchase order" description="Pantau draft dan purchase order yang sudah disepakati." />
      <Suspense fallback={<PurchaseOrdersTableFallback />}>
        <PurchaseOrdersTableSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function PurchaseOrdersTableFallback() {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-hidden="true">
      <FilterBarSkeleton searchWidth="w-full lg:max-w-xl" actionWidth="w-24" controls={1} />
      <div className="flex min-h-112 flex-1 flex-col">
        <TableSkeleton
          columns={8}
          rows={8}
          className="min-w-4xl"
          columnWidths={["w-12", "w-32", "w-32", "w-36", "w-20", "w-24", "w-24", "w-14"]}
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-52" />
      </div>
    </section>
  );
}
