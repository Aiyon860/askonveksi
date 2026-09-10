import { redirect } from "next/navigation";

import { DesignTaskActions } from "@/components/design/design-task-actions";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Palette } from "lucide-react";
import { getDesignTasks, type DesignTaskStatus } from "@/lib/design/data";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const statusLabel: Record<DesignTaskStatus, string> = { BELUM_DIUPLOAD: "Belum diupload", SUDAH_DIUPLOAD: "Sudah diupload", TERLAMBAT: "Terlambat" };

function href(query: string, status: DesignTaskStatus | "all", pageSize: number, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(pageSize));
  if (page > 1) params.set("page", String(page));
  return params.toString() ? `/desain?${params}` : "/desain";
}

export default async function DesignPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = first(params.status);
  const status = rawStatus === "BELUM_DIUPLOAD" || rawStatus === "SUDAH_DIUPLOAD" || rawStatus === "TERLAMBAT" ? rawStatus : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const { items, total, pageCount } = await getDesignTasks({ query, status, page, pageSize });
  if (page > pageCount) redirect(href(query, status, pageSize, pageCount));
  const persistent = { status: status === "all" ? undefined : status, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  return <>
    <PageHeader title="Upload Desain" description="Pantau deadline dan unggah setiap versi desain PO dari satu tempat." />
    <PageMessage />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><DebouncedSearchInput initialValue={query} pathname="/desain" params={persistent} placeholder="Cari nomor PO, customer, atau produk..." ariaLabel="Cari tugas desain" className="sm:max-w-md" /><div className="flex flex-wrap gap-2">{(["all", "BELUM_DIUPLOAD", "SUDAH_DIUPLOAD", "TERLAMBAT"] as const).map((item) => <a key={item} href={href(query, item, pageSize)} className={item === status ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" : "rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"}>{item === "all" ? "Semua" : statusLabel[item]}</a>)}</div></div>
      {items.length ? <><Table><TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Customer / produk</TableHead><TableHead>Deadline desain</TableHead><TableHead>Status</TableHead><TableHead>Upload terakhir</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => { const latest = item.revisions[0]; return <TableRow key={item.id}><TableCell className="font-mono text-xs">{item.purchaseOrder.purchaseOrderNo}</TableCell><TableCell><p className="font-medium">{item.purchaseOrder.opportunity.customer.companyName ?? item.purchaseOrder.opportunity.customer.name}</p><p className="text-sm text-muted-foreground">{item.purchaseOrder.productName}</p></TableCell><TableCell>{item.deadline.toLocaleDateString("id-ID")}</TableCell><TableCell><Badge variant={item.status === "TERLAMBAT" ? "destructive" : item.status === "SUDAH_DIUPLOAD" ? "success" : "secondary"}>{statusLabel[item.status]}</Badge></TableCell><TableCell>{latest ? <><p>Versi {latest.revision}</p><p className="text-xs text-muted-foreground">{latest.createdAt.toLocaleDateString("id-ID")}</p></> : "-"}</TableCell><TableCell className="text-right"><DesignTaskActions taskId={item.id} purchaseOrderNo={item.purchaseOrder.purchaseOrderNo} revisions={item.revisions.map((revision) => ({ ...revision, createdAt: revision.createdAt.toISOString() }))} /></TableCell></TableRow>; })}</TableBody></Table></> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><Palette aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada tugas desain</EmptyTitle><EmptyDescription>PO yang dibuat setelah fitur ini aktif akan muncul di sini.</EmptyDescription></EmptyHeader></Empty>}
      <DataPagination pathname="/desain" page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={{ q: query || undefined, ...persistent }} className="border-t px-4 py-3" />
    </section>
  </>;
}
