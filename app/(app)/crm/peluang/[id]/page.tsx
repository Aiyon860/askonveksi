import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown, FileText, Paperclip, Save } from "lucide-react";

import { agreePurchaseOrderAction, createInvoiceRevisionAction, createPurchaseOrderRevisionAction, issueInvoiceAction, updateOpportunityAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
import { CommunicationHistory } from "@/components/crm/communication-history";
import { DealPaymentForm } from "@/components/crm/deal-payment-form";
import { InvoiceForm } from "@/components/crm/invoice-form";
import { OpportunityFields } from "@/components/crm/opportunity-fields";
import { OpportunityStageForm } from "@/components/crm/opportunity-stage-form";
import { PurchaseOrderForm } from "@/components/crm/purchase-order-form";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { InvoiceStatusBadge, OpportunityStatusBadge, PurchaseOrderStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentActor } from "@/lib/auth/session";
import { getCommunicationTimeline, getOpportunityDetail } from "@/lib/crm/data";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { getCustomerFormOptions } from "@/lib/master-data";
import { parsePageParam } from "@/lib/pagination";

type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>;

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function OpportunityDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historyPage?: string | string[] }>;
}) {
  const { id } = await params;
  const historyPage = parsePageParam((await searchParams).historyPage);
  const [opportunity, actor, formOptions, communicationHistory] = await Promise.all([
    getOpportunityDetail(id),
    getCurrentActor(),
    getCustomerFormOptions(),
    getCommunicationTimeline({ opportunityId: id, page: historyPage }),
  ]);
  if (!opportunity || !actor) notFound();
  if (historyPage > communicationHistory.pageCount) redirect(`/crm/peluang/${id}?historyPage=${communicationHistory.pageCount}#communication-history`);

  const canOperate = actor.role === "ADMIN" || actor.role === "SALES";
  const canCompleteDeal = actor.role === "ADMIN";
  const inNegotiation = opportunity.stage === "NEGOSIASI";
  const poDraft = opportunity.purchaseOrders.find((item) => item.status === "DRAFT");
  const agreedPo = opportunity.purchaseOrders.find((item) => item.status === "AGREED");
  const invoiceDraft = opportunity.invoices.find((item) => item.status === "DRAFT");
  const issuedInvoice = opportunity.invoices.find((item) => item.status === "ISSUED" && item.purchaseOrderId === agreedPo?.id);

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/crm" />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Kembali ke pipeline
      </Button>
      <PageHeader
        title={opportunity.title}
        description={`${opportunity.opportunityNo} · ${opportunity.customer.name} · Diperbarui ${formatDate(opportunity.updatedAt, true)}`}
        action={<OpportunityStatusBadge stage={opportunity.stage} />}
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Kualifikasi dan next action</CardTitle>
              <CardDescription>Informasi awal peluang tetap terpisah dari PO dan invoice.</CardDescription>
            </CardHeader>
            <CardContent>
              {canOperate ? (
                <form action={updateOpportunityAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="version" value={opportunity.version} />
                  <OpportunityFields idPrefix="opportunity" leadSources={formOptions.leadSources} salesUsers={formOptions.salesUsers} values={opportunity} />
                  <div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Simpan setelah mengubah kualifikasi atau next action.</p>
                    <SubmitButton className="w-full sm:w-auto" size="lg" pendingLabel="Memperbarui...">
                      <Save data-icon="inline-start" aria-hidden="true" />
                      Simpan kualifikasi
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <OpportunityReadOnly opportunity={opportunity} />
              )}
            </CardContent>
          </Card>

          <Card id="purchase-orders">
            <CardHeader>
              <CardTitle>Purchase Order customer</CardTitle>
              <CardDescription>Satu rantai revisi berisi bahan, desain, ukuran, dan jumlah yang disepakati.</CardDescription>
            </CardHeader>
            <CardContent>
              {!inNegotiation && opportunity.purchaseOrders.length === 0 ? (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><FileText aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>PO belum diperlukan</EmptyTitle>
                    <EmptyDescription>Data PO baru tersedia saat peluang masuk ke Negosiasi.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-6">
                  {opportunity.purchaseOrders.map((purchaseOrder) => (
                    <section key={purchaseOrder.id} aria-labelledby={`po-${purchaseOrder.id}`} className="rounded-lg border p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 id={`po-${purchaseOrder.id}`} className="font-medium">{purchaseOrder.purchaseOrderNo} · Revisi {purchaseOrder.revision}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Dibuat {formatDate(purchaseOrder.createdAt, true)} oleh {purchaseOrder.createdBy.name}</p>
                        </div>
                        <PurchaseOrderStatusBadge status={purchaseOrder.status} />
                      </div>
                      {purchaseOrder.status === "DRAFT" && canOperate && inNegotiation ? (
                        <PurchaseOrderForm opportunityId={opportunity.id} draft={{
                          id: purchaseOrder.id,
                          version: purchaseOrder.version,
                          customerReference: purchaseOrder.customerReference ?? "",
                          productName: purchaseOrder.productName,
                          material: purchaseOrder.material,
                          color: purchaseOrder.color ?? "",
                          designNotes: purchaseOrder.designNotes ?? "",
                          notes: purchaseOrder.notes ?? "",
                          deadline: dateInputValue(purchaseOrder.deadline),
                          attachmentCount: purchaseOrder.attachments.length,
                          sizes: purchaseOrder.sizes,
                        }} />
                      ) : (
                        <PurchaseOrderSnapshot purchaseOrder={purchaseOrder} />
                      )}
                      {purchaseOrder.status === "DRAFT" && canOperate && inNegotiation ? (
                        <form action={agreePurchaseOrderAction} className="mt-4">
                          <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                          <input type="hidden" name="version" value={purchaseOrder.version} />
                          <ConfirmSubmitButton pendingLabel="Mengunci PO..." confirmTitle="Sepakati dan kunci PO?" confirmDescription="PO ini menjadi sumber resmi ukuran dan jumlah untuk invoice. Perubahan berikutnya dibuat sebagai revisi baru." confirmLabel="Ya, sepakati PO">
                            Sepakati PO
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                      {purchaseOrder.status === "AGREED" && canOperate && inNegotiation && !poDraft ? (
                        <form action={createPurchaseOrderRevisionAction} className="mt-4">
                          <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                          <ConfirmSubmitButton variant="outline" pendingLabel="Membuat revisi..." confirmTitle="Buat revisi PO?" confirmDescription="Draft baru dibuat dari data ini. Invoice terbit tetap aktif sampai revisi PO baru disepakati." confirmLabel="Ya, buat revisi">
                            Buat revisi PO
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </section>
                  ))}
                  {canOperate && inNegotiation && opportunity.purchaseOrders.length === 0 ? <PurchaseOrderForm opportunityId={opportunity.id} /> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="invoices">
            <CardHeader>
              <CardTitle>Invoice konveksi</CardTitle>
              <CardDescription>Harga mengikuti ukuran dan jumlah pada PO Disepakati.</CardDescription>
            </CardHeader>
            <CardContent>
              {!agreedPo && opportunity.invoices.length === 0 ? (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><FileDown aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>Invoice belum dapat dibuat</EmptyTitle>
                    <EmptyDescription>Sepakati PO customer terlebih dahulu.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-6">
                  {opportunity.invoices.map((invoice) => {
                    const invoicePo = opportunity.purchaseOrders.find((item) => item.id === invoice.purchaseOrderId);
                    return (
                      <section key={invoice.id} aria-labelledby={`invoice-${invoice.id}`} className="rounded-lg border p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 id={`invoice-${invoice.id}`} className="font-medium">{invoice.invoiceNo} · Revisi {invoice.revision}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Berdasarkan {invoicePo?.purchaseOrderNo ?? "PO"} · Dibuat {formatDate(invoice.createdAt, true)}</p>
                          </div>
                          <InvoiceStatusBadge status={invoice.status} />
                        </div>
                        {invoice.status === "DRAFT" && canOperate && inNegotiation && agreedPo && invoice.purchaseOrderId === agreedPo.id ? (
                          <InvoiceForm opportunityId={opportunity.id} purchaseOrder={agreedPo} draft={{
                            id: invoice.id,
                            version: invoice.version,
                            dueAt: dateInputValue(invoice.dueAt),
                            notes: invoice.notes ?? "",
                            discountType: invoice.discountType,
                            discountValue: invoice.discountValue.toString(),
                            items: invoice.items.map((item) => ({ ...item, unitPrice: item.unitPrice.toString() })),
                          }} />
                        ) : (
                          <InvoiceSnapshot invoice={invoice} />
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant="outline" render={<Link href={`/api/crm/invoice/${invoice.id}/pdf`} />} nativeButton={false}>
                            <FileDown data-icon="inline-start" aria-hidden="true" />
                            Unduh PDF
                          </Button>
                          {invoice.status === "DRAFT" && canOperate && inNegotiation ? (
                            <form action={issueInvoiceAction}>
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <input type="hidden" name="version" value={invoice.version} />
                              <ConfirmSubmitButton pendingLabel="Menerbitkan..." confirmTitle="Terbitkan dan kunci invoice?" confirmDescription="Draft tidak dapat diedit setelah diterbitkan. Perubahan harga berikutnya dibuat sebagai revisi." confirmLabel="Ya, terbitkan">Terbitkan invoice</ConfirmSubmitButton>
                            </form>
                          ) : null}
                          {invoice.status === "ISSUED" && canOperate && inNegotiation && !invoiceDraft && invoice.purchaseOrderId === agreedPo?.id ? (
                            <form action={createInvoiceRevisionAction}>
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <ConfirmSubmitButton variant="outline" pendingLabel="Membuat revisi..." confirmTitle="Buat revisi invoice?" confirmDescription="Invoice ini digantikan dan draft revisi baru dibuat dari harga yang sama." confirmLabel="Ya, buat revisi">Buat revisi invoice</ConfirmSubmitButton>
                            </form>
                          ) : null}
                          {invoice.salesOrder ? <Button variant="outline" render={<Link href={`/sales-orders/${invoice.salesOrder.id}`} />} nativeButton={false}>Lihat {invoice.salesOrder.salesOrderNo}</Button> : null}
                        </div>
                      </section>
                    );
                  })}
                  {canOperate && inNegotiation && agreedPo && !invoiceDraft && !issuedInvoice ? <InvoiceForm opportunityId={opportunity.id} purchaseOrder={agreedPo} /> : null}
                </div>
              )}
            </CardContent>
          </Card>

          {inNegotiation && canCompleteDeal ? (
            <Card id="complete-deal">
              <CardHeader>
                <CardTitle>Konfirmasi pembayaran dan Deal</CardTitle>
                <CardDescription>Hanya Admin yang dapat membentuk Sales Order setelah PO dan invoice siap.</CardDescription>
              </CardHeader>
              <CardContent>
                {agreedPo && issuedInvoice && !poDraft && !invoiceDraft ? (
                  <DealPaymentForm opportunityId={opportunity.id} opportunityVersion={opportunity.version} purchaseOrderId={agreedPo.id} invoiceId={issuedInvoice.id} invoiceVersion={issuedInvoice.version} total={issuedInvoice.total.toString()} initialPaidAt={toDateTimeLocalValue(new Date())} />
                ) : (
                  <Alert>
                    <AlertTitle>Dokumen belum lengkap</AlertTitle>
                    <AlertDescription>PO harus berstatus Disepakati dan invoice yang terkait harus berstatus Terbit sebelum peluang dapat menjadi Deal.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : null}

          <CommunicationHistory
            items={communicationHistory.items}
            total={communicationHistory.total}
            page={communicationHistory.page}
            pageCount={communicationHistory.pageCount}
            pathname={`/crm/peluang/${opportunity.id}`}
            form={canOperate && !opportunity.customer.archivedAt ? <CommunicationEntryForm context="opportunity" customerId={opportunity.customer.id} opportunityId={opportunity.id} initialOccurredAt={toDateTimeLocalValue(new Date())} /> : undefined}
          />
        </div>

        <aside className="flex flex-col gap-6 rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/6 p-3 sm:p-4">
          {canOperate ? (
            <Card>
              <CardHeader><CardTitle>Status pipeline</CardTitle><CardDescription>Tentukan langkah kerja berikutnya.</CardDescription></CardHeader>
              <CardContent><OpportunityStageForm opportunityId={opportunity.id} version={opportunity.version} initialStage={opportunity.stage} cancelReason={opportunity.cancelReason} /></CardContent>
            </Card>
          ) : null}
          <Card size="sm">
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{opportunity.customer.customerNo}</CardDescription>
              <CardAction><Button variant="link" size="sm" render={<Link href={`/crm/pelanggan/${opportunity.customer.id}`} />} nativeButton={false}>Buka profil</Button></CardAction>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{opportunity.customer.name}</p>
              {opportunity.customer.companyName ? <p className="text-sm text-muted-foreground">{opportunity.customer.companyName}</p> : null}
              <dl className="grid gap-2 text-sm text-muted-foreground">
                <div><dt className="sr-only">WhatsApp</dt><dd>{opportunity.customer.whatsapp ?? "-"}</dd></div>
                <div><dt className="sr-only">Email</dt><dd>{opportunity.customer.email ?? "-"}</dd></div>
                <div><dt className="sr-only">Instagram</dt><dd>{opportunity.customer.instagram ? `@${opportunity.customer.instagram}` : "-"}</dd></div>
              </dl>
            </CardContent>
          </Card>
          {opportunity.salesOrders.length ? (
            <Card size="sm">
              <CardHeader><CardTitle>Sales Order</CardTitle><CardDescription>Riwayat output Deal.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {opportunity.salesOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div><Link href={`/sales-orders/${order.id}`} className="font-mono text-sm underline-offset-4 hover:underline">{order.salesOrderNo}</Link><p className="mt-1 text-xs text-muted-foreground">{formatCurrency(order.total)} · {order.payment?.kind ?? "-"}</p></div>
                    <SalesOrderStatusBadge status={order.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function OpportunityReadOnly({ opportunity }: { opportunity: OpportunityDetail }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Produk awal</dt><dd className="mt-1">{opportunity.productName ?? "-"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">PIC sales</dt><dd className="mt-1">{opportunity.salesPic?.name ?? "-"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Estimasi jumlah</dt><dd className="mt-1 font-mono">{opportunity.estimatedQuantity ?? "-"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Estimasi nilai</dt><dd className="mt-1 font-mono">{formatCurrency(opportunity.estimatedValue)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Spesifikasi awal</dt><dd className="mt-1 whitespace-pre-wrap">{opportunity.specification ?? "-"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Next action</dt><dd className="mt-1">{opportunity.nextAction ? `${opportunity.nextAction} · ${formatDate(opportunity.nextActionAt, true)}` : "-"}</dd></div>
    </dl>
  );
}

function PurchaseOrderSnapshot({ purchaseOrder }: { purchaseOrder: OpportunityDetail["purchaseOrders"][number] }) {
  const total = purchaseOrder.sizes.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Referensi customer</dt><dd className="mt-1">{purchaseOrder.customerReference ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Jenis pakaian</dt><dd className="mt-1">{purchaseOrder.productName}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Bahan</dt><dd className="mt-1">{purchaseOrder.material}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Warna</dt><dd className="mt-1">{purchaseOrder.color ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Deadline</dt><dd className="mt-1">{formatDate(purchaseOrder.deadline)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total jumlah</dt><dd className="mt-1 font-mono">{total}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan desain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.designNotes ?? "-"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan lain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.notes ?? "-"}</dd></div>
      </dl>
      <Table>
        <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
        <TableBody>{purchaseOrder.sizes.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell></TableRow>)}</TableBody>
      </Table>
      {purchaseOrder.attachments.length ? (
        <div className="flex flex-wrap gap-2">
          {purchaseOrder.attachments.map((attachment) => (
            <Button key={attachment.id} size="sm" variant="outline" render={<Link href={`/api/crm/purchase-order/${purchaseOrder.id}/attachments/${attachment.id}`} target="_blank" rel="noreferrer" />} nativeButton={false}>
              <Paperclip data-icon="inline-start" aria-hidden="true" />
              {attachment.originalName}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InvoiceSnapshot({ invoice }: { invoice: OpportunityDetail["invoices"][number] }) {
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
        <TableBody>{invoice.items.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell>{item.description}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.subtotal)}</TableCell></TableRow>)}</TableBody>
      </Table>
      <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(invoice.subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{invoice.discountType === "PERCENTAGE" ? `${invoice.discountValue.toString()}%` : formatCurrency(invoice.discountValue)}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-2 font-medium"><dt>Total</dt><dd className="font-mono">{formatCurrency(invoice.total)}</dd></div>
      </dl>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Diterbitkan</dt><dd className="mt-1">{formatDate(invoice.issuedAt, true)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Jatuh tempo</dt><dd className="mt-1">{formatDate(invoice.dueAt)}</dd></div>
        {invoice.notes ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan</dt><dd className="mt-1 whitespace-pre-wrap">{invoice.notes}</dd></div> : null}
      </dl>
    </div>
  );
}
