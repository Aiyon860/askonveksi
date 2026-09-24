import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronDown, Eye, ListFilter, Pencil } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { getProductionDesignDetails, type DesignDetailDirection, type DesignDetailSort, type DesignDetailStatus } from "@/lib/production/design-detail";
import { cn } from "@/lib/utils";

const DESIGN_DETAIL_SORTS = ["workOrderNo", "purchaseOrderNo", "salesOrderNo", "customer", "productName", "route", "deadline", "designStatus"] as const satisfies readonly DesignDetailSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly DesignDetailDirection[];

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[]; pageSize?: string | string[]; sort?: string | string[]; order?: string | string[] }>;
type TableState = { query: string; status: DesignDetailStatus; page: number; pageSize: number; sort: DesignDetailSort; direction: DesignDetailDirection };

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function defaultDirection(): DesignDetailDirection { return "asc"; }
function parseSort(value: string | string[] | undefined): DesignDetailSort { const raw = firstParam(value); return DESIGN_DETAIL_SORTS.find((item) => item === raw) ?? "deadline"; }
function parseDirection(value: string | string[] | undefined): DesignDetailDirection { const raw = firstParam(value); return DIRECTIONS.find((item) => item === raw) ?? defaultDirection(); }
function tableHref(state: TableState, changes: Partial<TableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "deadline") params.set("sort", next.sort);
  if (next.direction !== defaultDirection()) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/detail-desain?${query}` : "/detail-desain";
}
function sortHref(state: TableState, sort: DesignDetailSort) {
  const direction = state.sort === sort ? state.direction === "asc" ? "desc" : "asc" : defaultDirection();
  return tableHref(state, { sort, direction, page: 1 });
}

export default async function DetailDesainPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim().slice(0, 80);
  const status: DesignDetailStatus = ["pending", "sent"].includes(firstParam(params.status) ?? "") ? firstParam(params.status) as DesignDetailStatus : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = parseSort(params.sort);
  const direction = parseDirection(params.order);
  const state = { query, status, page, pageSize, sort, direction } satisfies TableState;
  const { items: workOrders, total, pageCount } = await getProductionDesignDetails(state);
  if (page > pageCount) redirect(tableHref(state, { page: pageCount }));
  const persistentParams = { q: query || undefined, status: status !== "all" ? status : undefined, sort: sort !== "deadline" ? sort : undefined, order: direction !== defaultDirection() ? direction : undefined, pageSize: pageSize !== DATA_PAGE_SIZE ? String(pageSize) : undefined };
  return <>
    <PageHeader title="Detail Desain" description="Work Order masuk ke kanban Produksi setelah desain diberi keterangan oleh tim Produksi." />
    <PageMessage />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar Work Order Detail Desain">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"><DebouncedSearchInput key={query} initialValue={query} pathname="/detail-desain" params={persistentParams} placeholder="Cari nomor, customer, atau produk..." ariaLabel="Cari Detail Desain" className="sm:max-w-md" /><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}><ListFilter data-icon="inline-start" aria-hidden="true" />{status === "pending" ? "Belum dikirim" : status === "sent" ? "Masuk Produksi" : "Semua desain"}<ChevronDown data-icon="inline-end" aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-48"><DropdownMenuGroup><DropdownMenuLabel>Status desain</DropdownMenuLabel>{(["all", "pending", "sent"] as const).map((item) => <DropdownMenuItem key={item} render={<Link href={tableHref(state, { status: item, page: 1 })} />}><Check className={cn(status !== item && "opacity-0")} aria-hidden="true" />{item === "pending" ? "Belum dikirim" : item === "sent" ? "Masuk Produksi" : "Semua desain"}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end"><p className="text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> Work Order tersedia</p></div>
      </div>
      {workOrders.length ? <div className="flex min-h-112 flex-1 flex-col">
      <Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="Work Order" href={sortHref(state, "workOrderNo")} active={sort === "workOrderNo"} direction={direction} /><SortableTableHead label="PO" href={sortHref(state, "purchaseOrderNo")} active={sort === "purchaseOrderNo"} direction={direction} /><SortableTableHead label="Sales Order" href={sortHref(state, "salesOrderNo")} active={sort === "salesOrderNo"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} className="min-w-48" /><SortableTableHead label="Produk" href={sortHref(state, "productName")} active={sort === "productName"} direction={direction} className="min-w-48" /><SortableTableHead label="Jalur" href={sortHref(state, "route")} active={sort === "route"} direction={direction} /><SortableTableHead label="Deadline" href={sortHref(state, "deadline")} active={sort === "deadline"} direction={direction} /><SortableTableHead label="Status desain" href={sortHref(state, "designStatus")} active={sort === "designStatus"} direction={direction} /><TableHead className="w-32">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{workOrders.map((workOrder, index) => <TableRow key={workOrder.id}>
          <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono text-muted-foreground">{workOrder.workOrderNo}</TableCell><TableCell className="font-mono text-muted-foreground">{workOrder.salesOrder.purchaseOrder.purchaseOrderNo}</TableCell><TableCell className="font-mono text-muted-foreground">{workOrder.salesOrder.salesOrderNo}</TableCell><TableCell><span className="font-medium text-primary">{workOrder.salesOrder.snapshotCustomerName}</span></TableCell><TableCell>{workOrder.productName}</TableCell><TableCell className="text-muted-foreground">{workOrder.route === "JERSEY" ? "Jersey" : "Non-jersey"}</TableCell><TableCell className="text-muted-foreground">{workOrder.deadline.toLocaleDateString("id-ID")}</TableCell>
          <TableCell><Badge variant={workOrder.designCompletedAt ? "success" : "warning"}>{workOrder.designCompletedAt ? "Masuk Produksi" : "Belum dikirim"}</Badge></TableCell>
          <TableCell><Button size="sm" variant={workOrder.designCompletedAt ? "secondary" : "default"} nativeButton={false} render={<Link href={`/detail-desain/${workOrder.id}`}>{workOrder.designCompletedAt ? <Eye data-icon="inline-start" aria-hidden="true" /> : <Pencil data-icon="inline-start" aria-hidden="true" />}{workOrder.designCompletedAt ? "Lihat desain" : "Edit desain"}</Link>} /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <DataPagination pathname="/detail-desain" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistentParams} className="border-t px-4 py-3" />
      </div>
      : <Empty><EmptyHeader><EmptyTitle>{query ? "Work Order tidak ditemukan" : status === "all" ? "Belum ada Work Order" : "Tidak ada Work Order dengan status ini"}</EmptyTitle><EmptyDescription>{query ? "Coba kata kunci lain atau hapus filter pencarian." : "Work Order dari pembayaran pertama akan muncul di sini untuk diberi keterangan desain."}</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
