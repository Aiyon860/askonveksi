import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PurchaseOrderDetail } from "@/components/crm/purchase-order-detail";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FilterBarSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { DocumentPrintButton } from "@/components/crm/document-print-button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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

async function PurchaseOrdersTableSection({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status: PurchaseOrderListStatus = rawStatus === "DRAFT" || rawStatus === "AGREED" || rawStatus === "SUPERSEDED" ? rawStatus : "all";
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

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar purchase order">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/purchase-orders" params={persistent} placeholder="Cari no. PO, produk, atau customer..." ariaLabel="Cari purchase order" className="sm:max-w-md" />
      <form action="/crm/purchase-orders" className="flex flex-wrap items-end gap-2">
        {query ? <input type="hidden" name="q" value={query} /> : null}
        {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        {sort !== "createdAt" ? <input type="hidden" name="sort" value={sort} /> : null}
        {direction !== defaultDirection(sort) ? <input type="hidden" name="order" value={direction} /> : null}
        <Field className="w-40 gap-1"><FieldLabel htmlFor="po-status">Status</FieldLabel><NativeSelect id="po-status" name="status" defaultValue={status}><NativeSelectOption value="all">Semua status</NativeSelectOption><NativeSelectOption value="DRAFT">Draft</NativeSelectOption><NativeSelectOption value="AGREED">Disepakati</NativeSelectOption><NativeSelectOption value="SUPERSEDED">Digantikan</NativeSelectOption></NativeSelect></Field>
        <Field className="w-40 gap-1"><FieldLabel htmlFor="po-from">Dari tanggal</FieldLabel><Input key={range.from} id="po-from" name="from" type="date" max={range.today} defaultValue={range.from} /></Field>
        <Field className="w-40 gap-1"><FieldLabel htmlFor="po-to">Sampai tanggal</FieldLabel><Input key={range.to} id="po-to" name="to" type="date" max={range.today} defaultValue={range.to} /></Field>
        <Button type="submit" variant="outline">Terapkan</Button>
        <Button variant="secondary" nativeButton={false} render={<Link href="/crm/purchase-orders" />}>Reset</Button>
        <p className="ml-auto text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> purchase order</p>
      </form>
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
      <FilterBarSkeleton searchWidth="w-full sm:max-w-md" actionWidth="w-36" controls={5} />
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
