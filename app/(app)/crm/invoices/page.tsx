import { Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InvoiceDetail } from "@/components/crm/invoice-detail";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInvoices, type InvoiceListStatus } from "@/lib/crm/data";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

async function InvoicesTableSection({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status: InvoiceListStatus = rawStatus === "DRAFT" || rawStatus === "ISSUED" ? rawStatus : "all";
  const rawYear = first(params.year);
  const parsedYear = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  const year = parsedYear && parsedYear >= 2000 && parsedYear <= new Date().getUTCFullYear() + 1 ? parsedYear : null;
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const { items, total, years, pageCount } = await getInvoices({ query, status, year, page, pageSize });
  const persistent = { q: query || undefined, status: status === "all" ? undefined : status, year: year ? String(year) : undefined, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  if (page > pageCount) redirect(`/crm/invoices?${new URLSearchParams(Object.entries(persistent).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`);

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background" aria-label="Daftar invoice">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/invoices" params={persistent} placeholder="Cari no. invoice, customer, atau no. PO..." ariaLabel="Cari invoice" className="sm:max-w-md" />
      <form action="/crm/invoices" className="flex flex-wrap items-center gap-2">
        {query ? <input type="hidden" name="q" value={query} /> : null}{pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        <NativeSelect name="status" defaultValue={status} aria-label="Filter status invoice"><NativeSelectOption value="all">Semua status</NativeSelectOption><NativeSelectOption value="DRAFT">Draft</NativeSelectOption><NativeSelectOption value="ISSUED">Diterbitkan</NativeSelectOption></NativeSelect>
        <NativeSelect name="year" defaultValue={year ? String(year) : ""} aria-label="Filter tahun invoice"><NativeSelectOption value="">Semua tahun</NativeSelectOption>{years.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect>
        <Button type="submit" variant="outline">Terapkan</Button><p className="ml-auto text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> invoice</p>
      </form>
    </div>
    {items.length ? <div className="flex min-h-112 flex-1 flex-col">
      <Table className="min-w-4xl" containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><TableHead>No. Invoice</TableHead><TableHead>Customer</TableHead><TableHead>No. PO</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Tanggal dibuat</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item, index) => <InvoiceDetail key={item.id} id={item.id}>
          <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono">{item.invoiceNo}</TableCell><TableCell>{item.snapshotCompanyName ?? item.snapshotCustomerName}</TableCell><TableCell className="font-mono">{item.purchaseOrder.purchaseOrderNo}</TableCell><TableCell><InvoiceStatusBadge status={item.status} /></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.total)}</TableCell><TableCell>{formatDate(item.createdAt)}</TableCell>
        </InvoiceDetail>)}</TableBody>
      </Table>
      <DataPagination pathname="/crm/invoices" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
    </div> : <Empty><EmptyHeader><EmptyMedia variant="icon"><Receipt aria-hidden="true" /></EmptyMedia><EmptyTitle>Invoice tidak ditemukan</EmptyTitle><EmptyDescription>Coba ubah kata kunci atau filter yang digunakan.</EmptyDescription></EmptyHeader></Empty>}
  </section>;
}

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return <><PageHeader title="Invoice" description="Pantau draft dan invoice yang sudah diterbitkan." /><Suspense fallback={<Skeleton className="min-h-112 w-full" />}><InvoicesTableSection searchParams={searchParams} /></Suspense></>;
}
