"use client";

import Link from "next/link";
import { useState } from "react";

import { invoiceDetailAction } from "@/app/actions/crm-details";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/crm/format";

type Detail = Awaited<ReturnType<typeof invoiceDetailAction>>;

export function InvoiceDetail({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);

  async function showDetail() {
    setOpen(true);
    if (detail) return;
    try {
      setDetail(await invoiceDetailAction(id));
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <TableRow tabIndex={0} role="button" aria-haspopup="dialog" onClick={showDetail} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void showDetail(); }
      }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {children}
      </TableRow>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Detail invoice</DialogTitle><DialogDescription>Nilai tagihan dan rincian item invoice.</DialogDescription></DialogHeader>
          {!detail && !error ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Spinner /> Memuat detail...</div> : null}
          {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail invoice tidak dapat dimuat.</p> : null}
          {detail ? <div className="flex flex-col gap-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="No. Invoice" value={detail.invoiceNo} mono />
              <Info label="No. PO" value={detail.purchaseOrder.purchaseOrderNo} mono />
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><InvoiceStatusBadge status={detail.status} /></dd></div>
              <Info label="Customer" value={detail.snapshotCompanyName ?? detail.snapshotCustomerName} />
              <Info label="Tanggal dibuat" value={formatDate(detail.createdAt)} />
              <Info label="Jatuh tempo" value={formatDate(detail.dueAt)} />
            </dl>
            <Table>
              <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
              <TableBody>{detail.items.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell>{item.description}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.subtotal)}</TableCell></TableRow>)}</TableBody>
            </Table>
            <dl className="ml-auto grid w-full gap-2 sm:max-w-xs"><Total label="Subtotal" value={formatCurrency(detail.subtotal)} /><Total label="Diskon" value={detail.discountType === "PERCENTAGE" ? `${detail.discountValue}%` : formatCurrency(detail.discountValue)} /><Total label="Total" value={formatCurrency(detail.total)} strong /></dl>
            {detail.notes ? <Info label="Catatan" value={detail.notes} /> : null}
          </div> : null}
          {detail ? <DialogFooter><Button nativeButton={false} render={<Link href={`/crm/peluang/${detail.opportunity.id}`} />}>Lihat di Pipeline</Button></DialogFooter> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-6"><dt className="text-muted-foreground">{label}</dt><dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd></div>; }
