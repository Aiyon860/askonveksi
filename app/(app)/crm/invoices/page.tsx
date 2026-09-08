import { Receipt } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InvoiceDetail } from "@/components/crm/invoice-detail";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FilterBarSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInvoices, type InvoiceListSort, type InvoiceListStatus, type SortDirection } from "@/lib/crm/data";
import { parseDocumentDateRange } from "@/lib/crm/document-list-filters";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const SORTS = ["invoiceNo", "customer", "purchaseOrderNo", "status", "total", "createdAt"] as const satisfies readonly InvoiceListSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type TableState = {
  query: string;
  status: InvoiceListStatus;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sort: InvoiceListSort;
  direction: SortDirection;
};

function defaultDirection(sort: InvoiceListSort): SortDirection {
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
  return query ? `/crm/invoices?${query}` : "/crm/invoices";
}

function sortHref(state: TableState, sort: InvoiceListSort) {
  const direction = state.sort === sort
    ? state.direction === "asc" ? "desc" : "asc"
    : defaultDirection(sort);
  return tableHref(state, { sort, direction, page: 1 });
}

async function InvoicesTableSection({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status: InvoiceListStatus = rawStatus === "DRAFT" || rawStatus === "ISSUED" || rawStatus === "SUPERSEDED" ? rawStatus : "all";
  const range = parseDocumentDateRange(params.from, params.to);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const rawSort = first(params.sort);
  const sort = SORTS.find((item) => item === rawSort) ?? "createdAt";
  const rawDirection = first(params.order);
  const direction = DIRECTIONS.find((item) => item === rawDirection) ?? defaultDirection(sort);
  const state = { query, status, from: range.from, to: range.to, page, pageSize, sort, direction } satisfies TableState;
  const { items, total, pageCount } = await getInvoices({ query, status, start: range.start, end: range.end, page, pageSize, sort, direction });
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

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar invoice">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/invoices" params={persistent} placeholder="Cari no. invoice, customer, atau no. PO..." ariaLabel="Cari invoice" className="sm:max-w-md" />
      <form action="/crm/invoices" className="flex flex-wrap items-end gap-2">
        {query ? <input type="hidden" name="q" value={query} /> : null}{pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        {sort !== "createdAt" ? <input type="hidden" name="sort" value={sort} /> : null}
        {direction !== defaultDirection(sort) ? <input type="hidden" name="order" value={direction} /> : null}
        <Field className="w-40 gap-1"><FieldLabel htmlFor="invoice-status">Status</FieldLabel><NativeSelect id="invoice-status" name="status" defaultValue={status}><NativeSelectOption value="all">Semua status</NativeSelectOption><NativeSelectOption value="DRAFT">Draft</NativeSelectOption><NativeSelectOption value="ISSUED">Diterbitkan</NativeSelectOption><NativeSelectOption value="SUPERSEDED">Digantikan</NativeSelectOption></NativeSelect></Field>
        <Field className="w-40 gap-1"><FieldLabel htmlFor="invoice-from">Dari tanggal</FieldLabel><Input key={range.from} id="invoice-from" name="from" type="date" max={range.today} defaultValue={range.from} /></Field>
        <Field className="w-40 gap-1"><FieldLabel htmlFor="invoice-to">Sampai tanggal</FieldLabel><Input key={range.to} id="invoice-to" name="to" type="date" max={range.today} defaultValue={range.to} /></Field>
        <Button type="submit" variant="outline">Terapkan</Button>
        <Button variant="secondary" nativeButton={false} render={<Link href="/crm/invoices" />}>Reset</Button>
        <p className="ml-auto text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> invoice</p>
      </form>
    </div>
    {items.length ? <div className="flex min-h-112 flex-1 flex-col">
      <Table className="min-w-4xl" containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="No. Invoice" href={sortHref(state, "invoiceNo")} active={sort === "invoiceNo"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} /><SortableTableHead label="No. PO" href={sortHref(state, "purchaseOrderNo")} active={sort === "purchaseOrderNo"} direction={direction} /><SortableTableHead label="Status" href={sortHref(state, "status")} active={sort === "status"} direction={direction} /><SortableTableHead label="Total" href={sortHref(state, "total")} active={sort === "total"} direction={direction} className="text-right" /><SortableTableHead label="Tanggal dibuat" href={sortHref(state, "createdAt")} active={sort === "createdAt"} direction={direction} /></TableRow></TableHeader>
        <TableBody>{items.map((item, index) => <InvoiceDetail key={item.id} id={item.id}>
          <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono">{item.invoiceNo}</TableCell><TableCell>{item.snapshotCompanyName ?? item.snapshotCustomerName}</TableCell><TableCell className="font-mono">{item.purchaseOrder.purchaseOrderNo}</TableCell><TableCell><InvoiceStatusBadge status={item.status} /></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.total)}</TableCell><TableCell>{formatDate(item.createdAt)}</TableCell>
        </InvoiceDetail>)}</TableBody>
      </Table>
      <DataPagination pathname="/crm/invoices" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
    </div> : <Empty><EmptyHeader><EmptyMedia variant="icon"><Receipt aria-hidden="true" /></EmptyMedia><EmptyTitle>{hasFilters ? "Invoice tidak ditemukan" : "Belum ada invoice"}</EmptyTitle><EmptyDescription>{hasFilters ? "Coba ubah kata kunci atau filter yang digunakan." : "Invoice yang dibuat dari purchase order akan muncul di sini."}</EmptyDescription></EmptyHeader></Empty>}
  </section>;
}

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Invoice" description="Pantau draft dan invoice yang sudah diterbitkan." />
      <Suspense fallback={<InvoicesTableFallback />}>
        <InvoicesTableSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function InvoicesTableFallback() {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-hidden="true">
      <FilterBarSkeleton searchWidth="w-full sm:max-w-md" actionWidth="w-36" controls={5} />
      <div className="flex min-h-112 flex-1 flex-col">
        <TableSkeleton
          columns={7}
          rows={8}
          className="min-w-4xl"
          columnWidths={["w-12", "w-32", "w-36", "w-32", "w-20", "w-24", "w-24"]}
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-52" />
      </div>
    </section>
  );
}
