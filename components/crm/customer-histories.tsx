"use client";

import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";

import { getCustomerHistory } from "@/app/actions/customer-history";
import { OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMMUNICATION_CHANNEL_LABEL, COMMUNICATION_DIRECTION_LABEL, COMMUNICATION_SYSTEM_EVENT_LABEL, PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { CUSTOMER_HISTORY_PAGE_SIZES, type CustomerHistoryData } from "@/lib/crm/customer-history";

type State = { query: string; page: number; pageSize: number; filter?: string; status?: string; from?: string; to?: string; stage?: string };
type Props = { customerId: string; initial: { communication: CustomerHistoryData; order: CustomerHistoryData; opportunity: CustomerHistoryData }; initialState: { communication: State; order: State; opportunity: State }; communicationForm?: ReactNode };
type Kind = keyof Props["initial"];
type CommunicationItem = { id: string; kind: string; channel: string | null; direction: string | null; systemEvent: string | null; content: string; metadata: unknown; occurredAt: string; createdAt: string; author: { name: string }; opportunity: { id: string; opportunityNo: string; title: string } | null };
type OrderItem = { id: string; salesOrderNo: string; purchaseOrderNo: string; invoiceNo: string; status: string; total: string; acceptedAt: string; opportunity: { id: string; opportunityNo: string; title: string }; items: Array<{ id: string; description: string; quantity: number }> };
type OpportunityItem = { id: string; opportunityNo: string; title: string; stage: string; updatedAt: string };
const defaults: Record<Kind, State> = {
  communication: { query: "", filter: "all", page: 1, pageSize: 5 },
  order: { query: "", status: "all", from: "", to: "", page: 1, pageSize: 5 },
  opportunity: { query: "", stage: "all", page: 1, pageSize: 5 },
};

function metadataString(metadata: unknown, key: string) {
  return metadata && !Array.isArray(metadata) && typeof metadata === "object" && typeof (metadata as Record<string, unknown>)[key] === "string" ? (metadata as Record<string, string>)[key] : null;
}

function OrderItems({ items }: { items: Array<{ id: string; description: string; quantity: number }> }) {
  const list = (values: typeof items) => <ul className="space-y-1.5">{values.map((item) => <li key={item.id} className="wrap-break-word">{item.description} <span className="font-mono text-xs text-muted-foreground">{item.quantity} pcs</span></li>)}</ul>;
  const rest = items.slice(2);
  return <div className="min-w-72">{list(items.slice(0, 2))}{rest.length ? <details className="mt-2 text-sm"><summary className="w-fit cursor-pointer text-muted-foreground underline-offset-4 hover:underline">Lihat {rest.length} item lainnya</summary><div className="mt-2 border-t pt-2">{list(rest)}</div></details> : null}</div>;
}

function Pagination({ state, data, onChange }: { state: State; data: CustomerHistoryData; onChange: (next: Partial<State>) => void }) {
  if (!data.total) return null;
  const first = (state.page - 1) * state.pageSize + 1;
  return <div className="mt-4 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Menampilkan <strong className="font-medium text-foreground">{first}</strong> hingga <strong className="font-medium text-foreground">{Math.min(state.page * state.pageSize, data.total)}</strong> dari <strong className="font-medium text-foreground">{data.total}</strong> data</p><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-muted-foreground">Baris per halaman<NativeSelect size="sm" value={String(state.pageSize)} onChange={(event) => onChange({ pageSize: Number(event.target.value), page: 1 })} aria-label="Jumlah baris per halaman">{CUSTOMER_HISTORY_PAGE_SIZES.map((size) => <NativeSelectOption key={size} value={size}>{size}</NativeSelectOption>)}</NativeSelect></label><p className="whitespace-nowrap text-xs text-muted-foreground">Halaman <strong className="font-medium text-foreground">{state.page}</strong> / <strong className="font-medium text-foreground">{data.pageCount}</strong></p><Button size="icon-sm" variant="outline" aria-label="Ke halaman sebelumnya" disabled={state.page <= 1} onClick={() => onChange({ page: state.page - 1 })}>‹</Button><Button size="icon-sm" variant="outline" aria-label="Ke halaman berikutnya" disabled={state.page >= data.pageCount} onClick={() => onChange({ page: state.page + 1 })}>›</Button></div></div>;
}

function SearchInput({ value, placeholder, label, onChange, className }: { value: string; placeholder: string; label: string; onChange: (value: string) => void; className?: string }) {
  return <InputGroup className={className ?? (label === "Cari riwayat order" ? "sm:max-w-xs" : "sm:max-w-md")}><InputGroupInput type="search" value={value} maxLength={80} placeholder={placeholder} aria-label={label} onChange={(event) => onChange(event.target.value)} /><InputGroupAddon align="inline-start"><Search aria-hidden="true" /></InputGroupAddon></InputGroup>;
}

export function CustomerHistories({ customerId, initial, initialState, communicationForm }: Props) {
  const [data, setData] = useState(initial);
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [orderFiltersOpen, setOrderFiltersOpen] = useState(true);
  const [, startTransition] = useTransition();
  const requestId = useRef(0);
  const searchTimers = useRef<Partial<Record<Kind, number>>>({});
  const [loadingKind, setLoadingKind] = useState<Kind | null>(null);

  function syncUrl(next: Props["initialState"]) {
    const params = new URLSearchParams(window.location.search);
    const write = (key: string, value: string | number | undefined, defaultValue?: string | number) => value && value !== defaultValue ? params.set(key, String(value)) : params.delete(key);
    write("historyQ", next.communication.query); write("historyFilter", next.communication.filter, "all"); write("historyPage", next.communication.page, 1); write("historySize", next.communication.pageSize, 5);
    write("orderQ", next.order.query); write("orderStatus", next.order.status, "all"); write("orderFrom", next.order.from); write("orderTo", next.order.to); write("orderPage", next.order.page, 1); write("orderSize", next.order.pageSize, 5);
    write("opportunityQ", next.opportunity.query); write("opportunityStage", next.opportunity.stage, "all"); write("opportunityPage", next.opportunity.page, 1); write("opportunitySize", next.opportunity.pageSize, 5);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  }

  function change(kind: Kind, patch: Partial<State>) {
    const nextState = { ...state, [kind]: { ...state[kind], ...patch } };
    const id = ++requestId.current;
    setState(nextState); setError(null); setLoadingKind(kind); syncUrl(nextState);
    startTransition(async () => {
      try {
        const result = await getCustomerHistory({ customerId, kind, ...nextState[kind] });
        if (id === requestId.current) setData((current) => ({ ...current, [kind]: result }));
      } catch {
        if (id === requestId.current) setError("Riwayat tidak dapat dimuat. Coba lagi.");
      } finally {
        if (id === requestId.current) setLoadingKind(null);
      }
    });
  }

  function search(kind: Kind, query: string) {
    setState((current) => ({ ...current, [kind]: { ...current[kind], query } }));
    if (searchTimers.current[kind]) window.clearTimeout(searchTimers.current[kind]);
    searchTimers.current[kind] = window.setTimeout(() => change(kind, { query: query.trim().slice(0, 80), page: 1 }), 300);
  }

  function reset(kind: Kind) {
    if (searchTimers.current[kind]) window.clearTimeout(searchTimers.current[kind]);
    change(kind, defaults[kind]);
  }

  const busy = (kind: Kind) => loadingKind === kind;
  const notice = error ? <Alert variant="destructive"><AlertTitle>Riwayat belum diperbarui</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null;

  return <><style>{`#order-history [data-slot="card-content"] { padding-top: 2rem; } #order-history [data-slot="card-content"] > div:first-child { align-items: end; margin-bottom: .75rem !important; } #order-history [class~="lg:text-right"] { display: flex; flex: 1; justify-content: flex-end; } #order-history [class~="lg:text-right"] > button, #order-history [class~="lg:text-right"] form button[type="submit"] { display: none; } #order-history [class~="lg:text-right"] form { display: flex !important; flex: 1; flex-wrap: wrap; align-items: end; justify-content: flex-end; gap: .5rem; margin-top: 0; } #order-history [class~="lg:text-right"] form > [data-slot="field"] { flex: 0 1 9rem; }`}</style>
    <Card id="communication-history"><CardHeader><CardTitle>Riwayat komunikasi</CardTitle><CardDescription>Aktivitas terbaru ditampilkan lebih dahulu. Semua entri bersifat permanen agar perpindahan PIC tetap dapat ditelusuri.</CardDescription></CardHeader><CardContent className="flex flex-col gap-6">{communicationForm}<div className="flex flex-col gap-3 border-y py-4 lg:flex-row lg:items-end lg:justify-between"><SearchInput value={state.communication.query} placeholder="Cari pesan, penulis, atau peluang..." label="Cari riwayat komunikasi" onChange={(value) => search("communication", value)} /><div className="flex flex-wrap items-end gap-2"><Field className="w-44 gap-1"><FieldLabel htmlFor="history-filter">Jenis / kanal</FieldLabel><NativeSelect id="history-filter" value={state.communication.filter} onChange={(event) => change("communication", { filter: event.target.value, page: 1 })}>{["all", "COMMUNICATION", "INTERNAL_NOTE", "SYSTEM", "WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"].map((value) => <NativeSelectOption key={value} value={value}>{value === "all" ? "Semua aktivitas" : value}</NativeSelectOption>)}</NativeSelect></Field><Button variant="secondary" onClick={() => reset("communication")}>Reset</Button></div></div>{busy("communication") ? <Spinner /> : null}{notice}{data.communication.items.length ? <Table className="min-w-4xl"><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Aktivitas</TableHead><TableHead>Pesan</TableHead><TableHead>Penulis</TableHead><TableHead>Peluang</TableHead></TableRow></TableHeader><TableBody>{data.communication.items.map((raw) => { const item = raw as CommunicationItem; const nextAction = metadataString(item.metadata, "nextAction"); return <TableRow key={item.id}><TableCell className="align-top"><div className="min-w-36 text-xs text-muted-foreground"><time dateTime={item.occurredAt}>{formatDate(item.occurredAt, true)}</time>{new Date(item.createdAt).getTime() - new Date(item.occurredAt).getTime() > 60_000 ? <span className="mt-1 block">Dicatat {formatDate(item.createdAt, true)}</span> : null}</div></TableCell><TableCell className="align-top"><Badge variant={item.kind === "SYSTEM" ? "outline" : "secondary"}>{item.kind === "INTERNAL_NOTE" ? "Catatan internal" : item.kind === "SYSTEM" && item.systemEvent ? (COMMUNICATION_SYSTEM_EVENT_LABEL as Record<string, string>)[item.systemEvent] : item.channel ? (COMMUNICATION_CHANNEL_LABEL as Record<string, string>)[item.channel] : "Komunikasi"}</Badge>{item.direction ? <span className="ml-2 text-xs text-muted-foreground">{(COMMUNICATION_DIRECTION_LABEL as Record<string, string>)[item.direction]}</span> : null}</TableCell><TableCell className="align-top whitespace-normal"><p className="whitespace-pre-wrap wrap-break-word text-sm leading-6">{item.content}</p>{nextAction ? <p className="mt-2 text-xs text-muted-foreground">Langkah berikutnya: {nextAction}</p> : null}</TableCell><TableCell className="align-top">{item.author.name}</TableCell><TableCell className="align-top whitespace-normal">{item.opportunity ? <Link href={`/crm/peluang/${item.opportunity.id}`} className="text-xs font-medium underline-offset-4 hover:underline">{item.opportunity.opportunityNo} · {item.opportunity.title}</Link> : "-"}</TableCell></TableRow>; })}</TableBody></Table> : <Empty className="p-8"><EmptyHeader><EmptyTitle>Belum ada aktivitas komunikasi</EmptyTitle><EmptyDescription>Catat percakapan pertama agar konteks customer tersedia untuk seluruh tim.</EmptyDescription></EmptyHeader></Empty>}<Pagination state={state.communication} data={data.communication} onChange={(patch) => change("communication", patch)} /></CardContent></Card>

    <Card id="order-history"><CardHeader><CardTitle>Riwayat order</CardTitle><CardDescription>Order terbaru ditampilkan lebih dahulu. Order yang dibatalkan tetap tercatat.</CardDescription></CardHeader><CardContent><div className="mb-6 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between"><SearchInput value={state.order.query} placeholder="Cari SO, PO, invoice, peluang, atau item..." label="Cari riwayat order" onChange={(value) => search("order", value)} /><div className="lg:text-right"><Button variant="outline" aria-expanded={orderFiltersOpen} onClick={() => setOrderFiltersOpen((open) => !open)}>{state.order.status !== "all" || state.order.from ? "Filter order aktif" : "Filter order"}</Button>{orderFiltersOpen ? <form className="mt-3 grid gap-2 text-left sm:grid-cols-5 sm:items-end" onSubmit={(event) => { event.preventDefault(); change("order", { page: 1 }); }}><Field className="min-w-32 gap-1"><FieldLabel htmlFor="order-status">Status</FieldLabel><NativeSelect id="order-status" value={state.order.status} onChange={(event) => setState((current) => ({ ...current, order: { ...current.order, status: event.target.value } }))}><NativeSelectOption value="all">Semua</NativeSelectOption><NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption><NativeSelectOption value="CANCELLED">Dibatalkan</NativeSelectOption></NativeSelect></Field><Field className="min-w-36 gap-1"><FieldLabel htmlFor="order-from">Dari tanggal</FieldLabel><Input id="order-from" type="date" value={state.order.from} onChange={(event) => setState((current) => ({ ...current, order: { ...current.order, from: event.target.value } }))} /></Field><Field className="min-w-36 gap-1"><FieldLabel htmlFor="order-to">Sampai tanggal</FieldLabel><Input id="order-to" type="date" value={state.order.to} onChange={(event) => setState((current) => ({ ...current, order: { ...current.order, to: event.target.value } }))} /></Field><Button type="submit" variant="outline">Terapkan</Button><Button type="button" variant="secondary" onClick={() => change("order", defaults.order)}>Reset</Button></form> : null}</div></div>{busy("order") ? <Spinner /> : null}{notice}{data.order.items.length ? <><Table className="min-w-7xl"><TableHeader><TableRow><TableHead className="min-w-56">No. SO</TableHead><TableHead className="min-w-52">Peluang</TableHead><TableHead className="min-w-80">Item</TableHead><TableHead className="min-w-24">Status</TableHead><TableHead className="min-w-28">Tanggal</TableHead><TableHead className="min-w-32 text-right">Total</TableHead></TableRow></TableHeader><TableBody>{data.order.items.map((raw) => { const order = raw as OrderItem; return <TableRow key={order.id}><TableCell className="align-top"><Link href={`/sales-orders/${order.id}`} className="inline-flex items-center gap-1 font-mono font-medium underline-offset-4 hover:underline">{order.salesOrderNo}<ExternalLink aria-hidden="true" className="size-3.5" /></Link><p className="mt-1 font-mono text-xs text-muted-foreground">{order.purchaseOrderNo} · {order.invoiceNo}</p></TableCell><TableCell className="align-top whitespace-normal"><Link href={`/crm/peluang/${order.opportunity.id}`} className="font-medium underline-offset-4 hover:underline">{order.opportunity.title}</Link><p className="mt-1 font-mono text-xs text-muted-foreground">{order.opportunity.opportunityNo}</p></TableCell><TableCell className="align-top whitespace-normal">{order.items.length ? <OrderItems items={order.items} /> : "-"}</TableCell><TableCell className="align-top"><SalesOrderStatusBadge status={order.status as never} /></TableCell><TableCell className="align-top">{formatDate(order.acceptedAt)}</TableCell><TableCell className="align-top text-right font-mono tabular-nums">{formatCurrency(order.total)}</TableCell></TableRow>; })}</TableBody></Table><Pagination state={state.order} data={data.order} onChange={(patch) => change("order", patch)} /></> : <Empty className="p-8"><EmptyHeader><EmptyTitle>Belum ada order</EmptyTitle><EmptyDescription>Riwayat akan muncul setelah pembayaran Deal dicatat dan Sales Order terbentuk.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>

    <Card id="opportunity-history"><CardHeader><CardTitle>Peluang CRM</CardTitle><CardDescription>Profil ini dipakai kembali setiap kali customer membuat order baru.</CardDescription></CardHeader><CardContent><div className="mb-6 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between"><SearchInput value={state.opportunity.query} placeholder="Cari nomor atau judul peluang..." label="Cari peluang CRM" onChange={(value) => search("opportunity", value)} /><div className="flex flex-wrap items-end gap-2"><Field className="w-40 gap-1"><FieldLabel htmlFor="opportunity-stage">Tahap</FieldLabel><NativeSelect id="opportunity-stage" value={state.opportunity.stage} onChange={(event) => change("opportunity", { stage: event.target.value, page: 1 })}><NativeSelectOption value="all">Semua tahap</NativeSelectOption>{PIPELINE_STAGES.map((stage) => <NativeSelectOption key={stage} value={stage}>{STAGE_LABEL[stage]}</NativeSelectOption>)}</NativeSelect></Field><Button variant="secondary" onClick={() => change("opportunity", defaults.opportunity)}>Reset</Button></div></div>{busy("opportunity") ? <Spinner /> : null}{notice}{data.opportunity.items.length ? <><Table className="min-w-3xl"><TableHeader><TableRow><TableHead>Peluang</TableHead><TableHead>Tahap</TableHead><TableHead>Diperbarui</TableHead></TableRow></TableHeader><TableBody>{data.opportunity.items.map((raw) => { const opportunity = raw as OpportunityItem; return <TableRow key={opportunity.id}><TableCell className="align-top"><Link href={`/crm/peluang/${opportunity.id}`} className="font-medium underline-offset-4 hover:underline">{opportunity.title}</Link><p className="mt-1 font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</p></TableCell><TableCell className="align-top"><OpportunityStatusBadge stage={opportunity.stage as never} /></TableCell><TableCell className="align-top">{formatDate(opportunity.updatedAt)}</TableCell></TableRow>; })}</TableBody></Table><Pagination state={state.opportunity} data={data.opportunity} onChange={(patch) => change("opportunity", patch)} /></> : <Empty className="p-8"><EmptyHeader><EmptyTitle>Belum ada peluang</EmptyTitle><EmptyDescription>Buat peluang pertama dari formulir di samping.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
  </>;
}
