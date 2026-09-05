"use client";

import Link from "next/link";
import { useState } from "react";

import { purchaseOrderDetailAction } from "@/app/actions/crm-details";
import { PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/crm/format";

type Detail = Awaited<ReturnType<typeof purchaseOrderDetailAction>>;

export function PurchaseOrderDetail({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);

  async function showDetail() {
    setOpen(true);
    if (detail) return;
    try {
      setDetail(await purchaseOrderDetailAction(id));
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <TableRow
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        onClick={showDetail}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void showDetail();
          }
        }}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </TableRow>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail purchase order</DialogTitle>
            <DialogDescription>Informasi pesanan customer dan rincian ukuran.</DialogDescription>
          </DialogHeader>
          {!detail && !error ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Spinner /> Memuat detail...</div> : null}
          {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail purchase order tidak dapat dimuat.</p> : null}
          {detail ? (
            <div className="flex flex-col gap-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info label="No. PO" value={detail.purchaseOrderNo} mono />
                <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><PurchaseOrderStatusBadge status={detail.status} /></dd></div>
                <Info label="Customer" value={detail.opportunity.customer.companyName ?? detail.opportunity.customer.name} />
                <Info label="Produk" value={detail.productName} />
                <Info label="Material" value={detail.material} />
                <Info label="Warna" value={detail.color ?? "-"} />
                <Info label="Deadline" value={formatDate(detail.deadline)} />
                <Info label="Tanggal dibuat" value={formatDate(detail.createdAt)} />
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-medium">Ukuran dan jumlah</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                  <TableBody>{detail.sizes.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              {detail.designNotes || detail.notes ? <dl className="grid gap-4 sm:grid-cols-2"><Info label="Catatan desain" value={detail.designNotes ?? "-"} /><Info label="Catatan" value={detail.notes ?? "-"} /></dl> : null}
            </div>
          ) : null}
          {detail ? <DialogFooter><Button nativeButton={false} render={<Link href={`/crm/peluang/${detail.opportunity.id}`} />}>Lihat di Pipeline</Button></DialogFooter> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd></div>;
}
