import { Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InvoiceDetail } from "@/components/crm/invoice-detail";
import { InvoiceFilterSheet } from "@/components/crm/invoice-filter-sheet";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FilterBarSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { DocumentPrintButton } from "@/components/crm/document-print-button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInvoices, type InvoiceListSort, type InvoiceListStatus, type InvoicePaymentStatus, type SortDirection } from "@/lib/crm/data";
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
  paymentStatus: InvoicePaymentStatus;
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
  if (next.paymentStatus !== "all") params.set("payment", next.paymentStatus);
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

function parseInvoiceStatus(value: string | string[] | undefined): InvoiceListStatus {
  const rawStatus = first(value);
  return rawStatus === "DRAFT" || rawStatus === "ISSUED" || rawStatus === "SUPERSEDED" ? rawStatus : "all";
}

function parsePaymentStatus(value: string | string[] | undefined): InvoicePaymentStatus {
  const rawPayment = first(value);
  return rawPayment === "PAID" || rawPayment === "UNPAID" || rawPayment === "NO_SALES_ORDER" ? rawPayment : "all";
}

function InvoicePaymentBadge({ status }: { status: InvoicePaymentStatus }) {
  if (status === "PAID") return <Badge variant="success">Lunas</Badge>;
  if (status === "UNPAID") return <Badge variant="warning">Belum lunas</Badge>;
  if (status === "PENDING_DP") return <Badge variant="secondary">Menunggu DP</Badge>;
  if (status === "PENDING_LUNAS") return <Badge variant="secondary">Menunggu Lunas</Badge>;
  return <Badge variant="secondary">Jadwal belum diatur</Badge>;
}

function invoiceStatusLabel(status: InvoiceListStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "ISSUED") return "Diterbitkan";
  if (status === "SUPERSEDED") return "Digantikan";
  return null;
}

function invoicePaymentLabel(status: InvoicePaymentStatus) {
  if (status === "PAID") return "Lunas";
  if (status === "UNPAID") return "Belum lunas";
  if (status === "NO_SALES_ORDER") return "Menunggu pembayaran awal";
  return null;
}

async function InvoicesTableSection({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const status = parseInvoiceStatus(params.status);
  const paymentStatus = parsePaymentStatus(params.payment);
  const range = parseDocumentDateRange(params.from, params.to);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const rawSort = first(params.sort);
  const sort = SORTS.find((item) => item === rawSort) ?? "createdAt";
  const rawDirection = first(params.order);
  const direction = DIRECTIONS.find((item) => item === rawDirection) ?? defaultDirection(sort);
  const state = { query, status, paymentStatus, from: range.from, to: range.to, page, pageSize, sort, direction } satisfies TableState;
  const { items, total, pageCount } = await getInvoices({ query, status, paymentStatus, start: range.start, end: range.end, page, pageSize, sort, direction });
  const persistent = {
    q: query || undefined,
    status: status === "all" ? undefined : status,
    payment: paymentStatus === "all" ? undefined : paymentStatus,
    from: range.from || undefined,
    to: range.to || undefined,
    sort: sort === "createdAt" ? undefined : sort,
    order: direction === defaultDirection(sort) ? undefined : direction,
    pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize),
  };
  if (page > pageCount) redirect(tableHref(state, { page: pageCount }));
  const hasFilters = Boolean(query || status !== "all" || paymentStatus !== "all" || range.start);
  const filterSummaryParts = [
    invoiceStatusLabel(status),
    invoicePaymentLabel(paymentStatus),
    range.from && range.to ? `${range.from} s.d. ${range.to}` : range.from ? `Mulai ${range.from}` : range.to ? `Sampai ${range.to}` : null,
  ].filter(Boolean);
  const activeFilterCount = Number(status !== "all") + Number(paymentStatus !== "all") + Number(Boolean(range.start));
  const activeSummary = filterSummaryParts.length ? filterSummaryParts.join(" · ") : "Semua invoice";

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar invoice">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/invoices" params={persistent} placeholder="Cari no. invoice, customer, atau no. PO..." ariaLabel="Cari invoice" className="w-full lg:max-w-xl" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:ml-auto lg:justify-end">
        <p className="text-xs text-muted-foreground lg:whitespace-nowrap"><strong className="font-medium text-foreground">{total}</strong> invoice</p>
        <div className="flex items-center gap-2">
          {filterSummaryParts.length ? <p className="hidden max-w-80 truncate text-xs text-muted-foreground xl:block">{activeSummary}</p> : null}
          <InvoiceFilterSheet
            query={query}
            status={status}
            paymentStatus={paymentStatus}
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
      <Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="No. Invoice" href={sortHref(state, "invoiceNo")} active={sort === "invoiceNo"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} /><SortableTableHead label="No. PO" href={sortHref(state, "purchaseOrderNo")} active={sort === "purchaseOrderNo"} direction={direction} /><SortableTableHead label="Status" href={sortHref(state, "status")} active={sort === "status"} direction={direction} /><TableHead className="min-w-32">Pembayaran</TableHead><SortableTableHead label="Total" href={sortHref(state, "total")} active={sort === "total"} direction={direction} className="text-right" /><SortableTableHead label="Tanggal dibuat" href={sortHref(state, "createdAt")} active={sort === "createdAt"} direction={direction} /><TableHead className="w-14 text-center"><span className="sr-only">Print</span></TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item, index) => <InvoiceDetail key={item.id} id={item.id}>
          <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono">{item.invoiceNo}</TableCell><TableCell>{item.snapshotCompanyName ?? item.snapshotCustomerName}</TableCell><TableCell className="font-mono">{item.purchaseOrder.purchaseOrderNo}</TableCell><TableCell><InvoiceStatusBadge status={item.status} /></TableCell><TableCell><InvoicePaymentBadge status={item.paymentStatus} /></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.total)}</TableCell><TableCell>{formatDate(item.createdAt)}</TableCell><TableCell className="text-center"><DocumentPrintButton href={`/api/crm/invoice/${item.id}/pdf`} label={`Print ${item.invoiceNo}`} /></TableCell>
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
      <FilterBarSkeleton searchWidth="w-full lg:max-w-xl" actionWidth="w-24" controls={1} />
      <div className="flex min-h-112 flex-1 flex-col">
        <TableSkeleton
          columns={9}
          rows={8}
          className="min-w-5xl"
          columnWidths={["w-12", "w-32", "w-36", "w-32", "w-20", "w-28", "w-24", "w-24", "w-14"]}
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-52" />
      </div>
    </section>
  );
}
