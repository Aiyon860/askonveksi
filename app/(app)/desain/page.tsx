import { redirect } from "next/navigation";
import Link from "next/link";

import { DesignTaskActions } from "@/components/design/design-task-actions";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Palette } from "lucide-react";
import { getDesignTasks, type DesignTaskListSort, type DesignTaskStatus, type SortDirection } from "@/lib/design/data";
import { parseOpenDateRange } from "@/lib/crm/document-list-filters";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const statusLabel: Record<DesignTaskStatus, string> = { BELUM_DIUPLOAD: "Belum diupload", MENUNGGU_PERSETUJUAN: "Menunggu persetujuan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak", TERLAMBAT: "Terlambat" };
const SORTS = ["purchaseOrderNo", "productName", "customer", "status", "deadline", "uploadedAt"] as const satisfies readonly DesignTaskListSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type TableState = { query: string; status: DesignTaskStatus | "all"; from: string; to: string; page: number; pageSize: number; sort: DesignTaskListSort; direction: SortDirection };

function defaultDirection(sort: DesignTaskListSort): SortDirection {
  return sort === "deadline" || sort === "uploadedAt" ? "desc" : "asc";
}

function tableHref(state: TableState, changes: Partial<TableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.status !== "all") params.set("status", next.status);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.sort !== "deadline") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  return params.toString() ? `/desain?${params}` : "/desain";
}

function sortHref(state: TableState, sort: DesignTaskListSort) {
  const direction = state.sort === sort ? state.direction === "asc" ? "desc" : "asc" : defaultDirection(sort);
  return tableHref(state, { sort, direction, page: 1 });
}

export default async function DesignPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status = rawStatus === "BELUM_DIUPLOAD" || rawStatus === "MENUNGGU_PERSETUJUAN" || rawStatus === "DISETUJUI" || rawStatus === "DITOLAK" || rawStatus === "TERLAMBAT" ? rawStatus : "all";
  const range = parseOpenDateRange(params.from, params.to);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = SORTS.find((item) => item === first(params.sort)) ?? "deadline";
  const direction = DIRECTIONS.find((item) => item === first(params.order)) ?? defaultDirection(sort);
  const state = { query, status, from: range.from, to: range.to, page, pageSize, sort, direction } satisfies TableState;
  const { items, total, pageCount, actorRole } = await getDesignTasks({ ...state, start: range.start, end: range.end });
  const canUpload = actorRole === "OWNER" || actorRole === "DESIGNER";
  const canReview = actorRole === "OWNER" || actorRole === "ADMIN_CUSTOMER";
  if (page > pageCount) redirect(tableHref(state, { page: pageCount }));
  const persistent = { q: query || undefined, status: status === "all" ? undefined : status, from: range.from || undefined, to: range.to || undefined, sort: sort === "deadline" ? undefined : sort, order: direction === defaultDirection(sort) ? undefined : direction, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  return <>
    <PageHeader title="Upload Desain" description="Pantau deadline, revisi, dan persetujuan desain PO dari satu tempat." />
    <PageMessage />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar upload desain">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <DebouncedSearchInput key={query} initialValue={query} pathname="/desain" params={persistent} placeholder="Cari no. PO, customer, atau produk..." ariaLabel="Cari tugas desain" className="w-full lg:max-w-xl" />
        <form action="/desain" className="flex flex-wrap items-end gap-2 lg:ml-auto">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
          {sort !== "deadline" ? <input type="hidden" name="sort" value={sort} /> : null}
          {direction !== defaultDirection(sort) ? <input type="hidden" name="order" value={direction} /> : null}
          <Field className="w-48 gap-1"><FieldLabel htmlFor="design-status">Status</FieldLabel><NativeSelect id="design-status" name="status" defaultValue={status}><NativeSelectOption value="all">Semua status</NativeSelectOption>{(["BELUM_DIUPLOAD", "MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "TERLAMBAT"] as const).map((item) => <NativeSelectOption key={item} value={item}>{statusLabel[item]}</NativeSelectOption>)}</NativeSelect></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="design-from">Dari tanggal</FieldLabel><Input key={range.from} id="design-from" name="from" type="date" defaultValue={range.from} /></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="design-to">Sampai tanggal</FieldLabel><Input key={range.to} id="design-to" name="to" type="date" defaultValue={range.to} /></Field>
          <Button type="submit" variant="outline">Terapkan</Button>
          <Button variant="secondary" nativeButton={false} render={<Link href="/desain" />}>Reset</Button>
          <p className="ml-auto text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> desain</p>
        </form>
      </div>
      {items.length ? <div><Table className="min-w-5xl" containerClassName="overflow-auto"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><SortableTableHead label="No. PO" href={sortHref(state, "purchaseOrderNo")} active={sort === "purchaseOrderNo"} direction={direction} /><SortableTableHead label="Customer" href={sortHref(state, "customer")} active={sort === "customer"} direction={direction} /><SortableTableHead label="Produk" href={sortHref(state, "productName")} active={sort === "productName"} direction={direction} /><SortableTableHead label="Deadline desain" href={sortHref(state, "deadline")} active={sort === "deadline"} direction={direction} /><SortableTableHead label="Status" href={sortHref(state, "status")} active={sort === "status"} direction={direction} /><SortableTableHead label="Upload terakhir" href={sortHref(state, "uploadedAt")} active={sort === "uploadedAt"} direction={direction} /><TableHead className="w-24 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{items.map((item, index) => { const latest = item.revisions[0]; return <TableRow key={item.id}><TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono">{item.purchaseOrder.purchaseOrderNo}</TableCell><TableCell>{item.purchaseOrder.opportunity.customer.companyName ?? item.purchaseOrder.opportunity.customer.name}</TableCell><TableCell>{item.purchaseOrder.productName}</TableCell><TableCell>{item.deadline.toLocaleDateString("id-ID")}</TableCell><TableCell><Badge variant={item.status === "MENUNGGU_PERSETUJUAN" ? "info" : item.status === "DISETUJUI" ? "success" : item.status === "DITOLAK" ? "destructive" : item.status === "TERLAMBAT" ? "warning" : "secondary"}>{statusLabel[item.status]}</Badge></TableCell><TableCell>{latest ? <><p>Versi {latest.revision}</p><p className="text-xs text-muted-foreground">{latest.createdAt.toLocaleDateString("id-ID")}</p></> : "-"}</TableCell><TableCell className="text-right"><DesignTaskActions taskId={item.id} purchaseOrderNo={item.purchaseOrder.purchaseOrderNo} revisions={item.revisions.map((revision) => ({ ...revision, createdAt: revision.createdAt.toISOString(), reviewedAt: revision.reviewedAt?.toISOString() ?? null }))} canUpload={canUpload} canReview={canReview} /></TableCell></TableRow>; })}</TableBody></Table><DataPagination pathname="/desain" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" /></div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><Palette aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada tugas desain</EmptyTitle><EmptyDescription>PO draft akan muncul di sini untuk diunggah dan ditinjau.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
