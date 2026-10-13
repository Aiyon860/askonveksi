"use client";

import Link from "next/link";
import { useState } from "react";
import { Paperclip } from "lucide-react";

import { purchaseOrderDetailAction } from "@/app/actions/crm-details";
import { DepositStatus } from "@/components/crm/deposit-status";
import { DocumentDetailTrigger } from "@/components/crm/document-detail-trigger";
import { PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/crm/format";
import { decorationMethodsLabel } from "@/lib/crm/constants";

type Detail = Awaited<ReturnType<typeof purchaseOrderDetailAction>>;

export function PurchaseOrderDetail({
  id,
  children,
  triggerClassName,
  triggerVariant,
}: {
  id: string;
  children: React.ReactNode;
  triggerClassName?: string;
  triggerVariant?: "preview" | "table-row";
}) {
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
      <DocumentDetailTrigger
        className={triggerClassName}
        onActivate={() => void showDetail()}
        variant={triggerVariant}
      >
        {children}
      </DocumentDetailTrigger>
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
                <Info label="Kategori" value={detail.productCategory?.name ?? "-"} />
                <Info label="Instansi" value={detail.instansi ?? "-"} />
                <Info label="Pola" value={detail.pola ?? detail.productName} />
                {detail.items.length ? <Info label="Produk" value={detail.items.map((poItem) => `${poItem.name} (${decorationMethodsLabel(poItem.decorationMethods)})`).join(" · ")} /> : null}
                <Info label="Material" value={detail.material} />
                <Info label="Warna" value={detail.color ?? "-"} />
                <Info label="Deadline produksi" value={formatDate(detail.deadline)} />
                <Info label="Tanggal dibuat" value={formatDate(detail.createdAt)} />
                <div><dt className="text-xs text-muted-foreground">Deposit</dt><dd className="mt-1"><DepositStatus paid={detail.deposit !== null} amount={detail.deposit?.amount ?? null} /></dd></div>
                <Info label="Tanggal deposit" value={detail.deposit ? formatDate(detail.deposit.paidAt, true) : "-"} />
                {detail.deposit?.paymentMethod ? <Info label="Metode deposit" value={detail.deposit.paymentMethod.name} /> : null}
                {detail.deposit?.reference ? <Info label="Referensi deposit" value={detail.deposit.reference} /> : null}
              </dl>
              {detail.garmentType === "AKSESORI" && !detail.items.length ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Jumlah produk</dt><dd className="mt-1 font-mono">{detail.sizes.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("id-ID")}</dd></div>
                </dl>
              ) : detail.items.length ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">Ukuran dan jumlah</h3>
                {detail.items.map((poItem) => {
                  const itemSizes = detail.sizes.filter((row) => row.itemId === poItem.id);
                  const itemTotal = itemSizes.reduce((sum, row) => sum + row.quantity, 0);
                  const itemIsAccessory = (poItem.garmentType ?? detail.garmentType) === "AKSESORI";
                  return (
                    <div key={poItem.id} className="rounded-lg border-2 border-primary/25 bg-primary/[0.04] p-3">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{poItem.name}</span>
                        <span className="text-xs text-muted-foreground">Total {itemTotal.toLocaleString("id-ID")}</span>
                      </div>
                      {itemIsAccessory ? null : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                        <TableBody>{itemSizes.map((row) => <TableRow key={row.id}><TableCell>{row.size}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.quantity}</TableCell></TableRow>)}</TableBody>
                      </Table>
                      )}
                    </div>
                  );
                })}
              </div>
              ) : (
              <div>
                <h3 className="mb-2 text-sm font-medium">Ukuran dan jumlah</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                  <TableBody>{detail.sizes.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              )}
              {detail.designNotes || detail.notes ? <dl className="grid gap-4 sm:grid-cols-2"><Info label="Catatan desain" value={detail.designNotes ?? "-"} /><Info label="Catatan" value={detail.notes ?? "-"} /></dl> : null}
              {detail.attachments.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Lampiran referensi</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detail.attachments.map((attachment) => (
                      <Button
                        key={attachment.id}
                        size="sm"
                        variant="outline"
                        className="h-auto min-h-9 max-w-full shrink justify-start whitespace-normal py-2 text-left leading-5"
                        render={<Link href={`/api/crm/purchase-order/${detail.id}/attachments/${attachment.id}`} />}
                        nativeButton={false}
                      >
                        <Paperclip data-icon="inline-start" aria-hidden="true" />
                        <span className="min-w-0">{attachment.originalName}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {detail ? <DialogFooter><Button nativeButton={false} render={<Link href={`/crm/peluang/${detail.opportunity.id}?tab=po`} />}>Lihat PO</Button></DialogFooter> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd></div>;
}
