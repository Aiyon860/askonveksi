import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { FilterBarSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProspects, type ProspectSort, type SortDirection } from "@/lib/crm/data";
import { parseOpenDateRange } from "@/lib/crm/document-list-filters";
import { formatDate } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TableState = { query: string; from: string; to: string; page: number; pageSize: number; sort: ProspectSort; direction: SortDirection };
const SORTS = ["opportunityNo", "customer", "city", "createdAt"] as const satisfies readonly ProspectSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const defaultDirection = (sort: ProspectSort): SortDirection => sort === "createdAt" ? "desc" : "asc";

function tableHref(state: TableState, changes: Partial<TableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.sort !== "createdAt") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/crm/prospek?${query}` : "/crm/prospek";
}

function sortHref(state: TableState, sort: ProspectSort) {
  const direction = state.sort === sort ? state.direction === "asc" ? "desc" : "asc" : defaultDirection(sort);
  return tableHref(state, { sort, direction, page: 1 });
}

async function ProspectsTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const range = parseOpenDateRange(params.from, params.to);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = SORTS.find((item) => item === first(params.sort)) ?? "createdAt";
  const direction = DIRECTIONS.find((item) => item === first(params.order)) ?? defaultDirection(sort);
  const state = { query, from: range.from, to: range.to, page, pageSize, sort, direction } satisfies TableState;
  const { items, total, pageCount } = await getProspects({ query, start: range.start, end: range.end, page, pageSize, sort, direction });
  const persistent = { q: query || undefined, from: range.from || undefined, to: range.to || undefined, sort: sort === "createdAt" ? undefined : sort, order: direction === defaultDirection(sort) ? undefined : direction, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  if (page > pageCount) redirect(tableHref(state, { page: pageCount }));
  const hasFilters = Boolean(query || range.from || range.to);

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Tabel Prospek">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <DebouncedSearchInput key={query} initialValue={query} pathname="/crm/prospek" params={persistent} placeholder="Cari nomor, customer, kontak, atau kota..." ariaLabel="Cari prospek" className="sm:max-w-md" />
      <form action="/crm/prospek" className="flex flex-wrap items-end gap-2">
        {query ? <input type="hidden" name="q" value={query} /> : null}
        {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        {sort !== "createdAt" ? <input type="hidden" name="sort" value={sort} /> : null}
        {direction !== defaultDirection(sort) ? <input type="hidden" name="order" value={direction} /> : null}
        <Field className="w-40 gap-1"><FieldLabel htmlFor="prospect-from">Dari tanggal</FieldLabel><Input id="prospect-from" name="from" type="date" defaultValue={range.from} /></Field>
        <Field className="w-40 gap-1"><FieldLabel htmlFor="prospect-to">Sampai tanggal</FieldLabel><Input id="prospect-to" name="to" type="date" defaultValue={range.to} /></Field>
        <Button type="submit" variant="outline">Terapkan</Button>
        <Button variant="secondary" nativeButton={false} render={<Link href="/crm/prospek" />}>Reset</Button>
        <p className="ml-auto text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> prospek</p>
      </form>
    </div>
    {items.length ? <div className="flex min-h-112 flex-1 flex-col"><Table className="min-w-6xl" containerClassName="min-h-0 flex-1 overflow-auto"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="No. prospek" href={sortHref(state, "opportunityNo")} active={sort === "opportunityNo"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} className="min-w-48" /><TableHead className="min-w-48">Kontak</TableHead><SortableTableHead label="Kota" href={sortHref(state, "city")} active={sort === "city"} direction={direction} /><TableHead className="min-w-56">Asal</TableHead><TableHead className="min-w-40">Sales/PIC</TableHead><TableHead className="min-w-32">Status</TableHead><SortableTableHead label="Tanggal input" href={sortHref(state, "createdAt")} active={sort === "createdAt"} direction={direction} /></TableRow></TableHeader><TableBody>{items.map((item, index) => { const contacts = [item.customer.whatsapp, item.customer.email, item.customer.instagram ? `@${item.customer.instagram}` : null].filter((value): value is string => Boolean(value)); return <TableRow key={item.id}><TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono text-muted-foreground">{item.opportunityNo}</TableCell><TableCell><Link href={`/crm/peluang/${item.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{item.customer.name}</Link>{item.customer.companyName ? <p className="mt-1 text-xs text-muted-foreground">{item.customer.companyName}</p> : null}</TableCell><TableCell>{contacts[0] ?? "-"}{contacts[1] ? <p className="mt-1 text-xs text-muted-foreground">{contacts[1]}</p> : null}</TableCell><TableCell>{item.customer.city ?? "-"}</TableCell><TableCell className="whitespace-normal">{item.customer.address ?? "-"}</TableCell><TableCell>{item.salesPic?.name ?? "Admin Customer"}</TableCell><TableCell><OpportunityStatusBadge stage={item.stage} /></TableCell><TableCell className="text-muted-foreground">{formatDate(item.createdAt, true)}</TableCell></TableRow>; })}</TableBody></Table><DataPagination pathname="/crm/prospek" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" /></div> : <Empty><EmptyHeader><EmptyMedia variant="icon"><UsersRound aria-hidden="true" /></EmptyMedia><EmptyTitle>{hasFilters ? "Prospek tidak ditemukan" : "Belum ada prospek"}</EmptyTitle><EmptyDescription>{hasFilters ? "Coba ubah kata kunci atau tanggal input." : "Tambahkan Prospek dari Pipeline CRM."}</EmptyDescription></EmptyHeader></Empty>}
  </section>;
}

export default function ProspectsPage({ searchParams }: { searchParams: SearchParams }) {
  return <><PageHeader title="Prospek" description="Pantau calon customer sampai peluang berubah menjadi Deal." /><PageMessage /><Suspense fallback={<section className="overflow-hidden rounded-lg border bg-card"><FilterBarSkeleton searchWidth="w-full sm:max-w-md" controls={4} /><TableSkeleton columns={9} rows={8} className="min-w-6xl" /></section>}><ProspectsTable searchParams={searchParams} /></Suspense></>;
}
