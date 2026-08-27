import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, LockKeyhole } from "lucide-react";

import { reverseSalesOrderAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SalesOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentActor } from "@/lib/auth/session";
import { getSalesOrderDetail } from "@/lib/crm/data";
import { formatCurrency, formatDate } from "@/lib/crm/format";

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, actor] = await Promise.all([getSalesOrderDetail(id), getCurrentActor()]);
  if (!order || !actor) notFound();
  const canReverse = order.status === "ACTIVE" && (actor.role === "OWNER" || actor.role === "ADMIN");

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href={`/crm/peluang/${order.opportunity.id}`} />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Kembali ke peluang
      </Button>
      <PageHeader
        title={order.salesOrderNo}
        description={`${order.opportunity.opportunityNo} · ${order.opportunity.title} · Dibuat ${formatDate(order.createdAt, true)}`}
        action={<SalesOrderStatusBadge status={order.status} />}
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Item Sales Order</CardTitle>
              <CardDescription>Snapshot immutable dari {order.quotationNo}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className="ml-auto mt-5 grid w-full max-w-sm gap-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(order.subtotal)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{order.discountType === "PERCENTAGE" ? `${order.discountValue.toString()}%` : formatCurrency(order.discountValue)}</dd></div>
                <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-mono">{formatCurrency(order.total)}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Snapshot customer</CardTitle>
              <CardDescription>Perubahan pada profil customer tidak mengubah data transaksi ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Customer</dt><dd className="mt-1 font-medium">{order.snapshotCustomerName}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Perusahaan</dt><dd className="mt-1">{order.snapshotCompanyName ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">WhatsApp</dt><dd className="mt-1">{order.snapshotWhatsapp ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1">{order.snapshotEmail ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Instagram</dt><dd className="mt-1">{order.snapshotInstagram ? `@${order.snapshotInstagram}` : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Alamat</dt><dd className="mt-1 whitespace-pre-wrap">{order.snapshotAddress ?? "—"}</dd></div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Jejak transaksi</CardTitle>
              <CardDescription>Sales Order final tidak dapat diedit.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">Dibentuk dari quotation revisi {order.quotation.revision}, diterima {formatDate(order.acceptedAt, true)} oleh {order.createdBy.name}.</p>
              </div>
              <p className="text-sm leading-6"><span className="text-muted-foreground">Referensi:</span><br />{order.quotation.acceptanceReference ?? "—"}</p>
              {order.quotation.acceptanceProofPath ? (
                <Button
                  variant="outline"
                  render={<Link href={`/api/crm/quotation/${order.quotation.id}/acceptance-proof`} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                >
                  <ImageIcon data-icon="inline-start" aria-hidden="true" />
                  Lihat bukti persetujuan
                </Button>
              ) : null}
              {order.status === "CANCELLED" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p className="font-medium">Dibatalkan {formatDate(order.cancelledAt, true)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{order.cancelReason}</p>
                  <p className="mt-2 text-xs">Oleh {order.cancelledBy?.name ?? "—"}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canReverse ? (
            <Card>
              <CardHeader>
                <CardTitle>Batalkan Deal</CardTitle>
                <CardDescription>Sales Order dibatalkan dan peluang kembali ke Penawaran. Riwayat Sales Order tetap tersimpan.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={reverseSalesOrderAction}>
                  <input type="hidden" name="salesOrderId" value={order.id} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="cancelReason" required>Alasan pembatalan</FieldLabel>
                      <Textarea id="cancelReason" name="cancelReason" required minLength={5} maxLength={2000} rows={4} />
                      <FieldDescription>Aksi ini dicatat dalam audit log dan tidak menghapus transaksi.</FieldDescription>
                    </Field>
                    <ConfirmSubmitButton
                      variant="destructive"
                      pendingLabel="Membatalkan..."
                      confirmTitle="Batalkan Sales Order?"
                      confirmDescription="Peluang akan kembali ke Penawaran. Sales Order tetap tersimpan sebagai riwayat dan tidak dapat diaktifkan kembali."
                      confirmLabel="Ya, batalkan Sales Order"
                    >
                      Batalkan Sales Order &amp; kembalikan peluang
                    </ConfirmSubmitButton>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
