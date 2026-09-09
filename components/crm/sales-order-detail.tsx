"use client";

import Link from "next/link";
import { useState } from "react";

import { salesOrderDetailAction } from "@/app/actions/crm-details";
import { DocumentDetailTrigger } from "@/components/crm/document-detail-trigger";
import { SalesOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/crm/format";

type Detail = Awaited<ReturnType<typeof salesOrderDetailAction>>;

export function SalesOrderDetail({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);
  async function showDetail() { setOpen(true); if (detail) return; try { setDetail(await salesOrderDetailAction(id)); } catch { setError(true); } }
  return <><DocumentDetailTrigger onActivate={() => void showDetail()}>{children}</DocumentDetailTrigger><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Detail Sales Order</DialogTitle><DialogDescription>Snapshot pesanan yang sudah disepakati.</DialogDescription></DialogHeader>
    {!detail && !error ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Spinner /> Memuat detail...</div> : null}
    {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail Sales Order tidak dapat dimuat.</p> : null}
    {detail ? <div className="flex flex-col gap-5"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label="No. SO" value={detail.salesOrderNo} mono /><Info label="No. PO" value={detail.purchaseOrderNo} mono /><Info label="No. Invoice" value={detail.invoiceNo} mono /><div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><SalesOrderStatusBadge status={detail.status} /></dd></div><Info label="Customer" value={detail.snapshotCompanyName ?? detail.snapshotCustomerName} /><Info label="Tanggal diterima" value={formatDate(detail.acceptedAt, true)} /></dl><Table><TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader><TableBody>{detail.items.map((item) => <TableRow key={item.id}><TableCell>{item.productName ?? "-"}</TableCell><TableCell>{item.description} · {item.size}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-between gap-4 rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Total</span><strong className="font-mono tabular-nums">{formatCurrency(detail.total)}</strong></div>{detail.cancelReason ? <Info label="Alasan pembatalan" value={detail.cancelReason} /> : null}</div> : null}
    {detail ? <DialogFooter><Button nativeButton={false} render={<Link href={`/sales-orders/${detail.id}`} />}>Lihat SO</Button></DialogFooter> : null}</DialogContent></Dialog></>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd></div>; }
