import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileDown, FileText, Paperclip, Save } from "lucide-react";

import { updateOpportunityAction } from "@/app/actions/crm";
import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
import { CommunicationHistory } from "@/components/crm/communication-history";
import { DealPaymentForm } from "@/components/crm/deal-payment-form";
import { InvoiceForm } from "@/components/crm/invoice-form";
import { InvoiceWorkflowSection } from "@/components/crm/invoice-workflow-section";
import { OpportunityFields } from "@/components/crm/opportunity-fields";
import { OpportunityProcessPanel, OpportunityProcessTabs } from "@/components/crm/opportunity-process-tabs";
import { OpportunityStageForm } from "@/components/crm/opportunity-stage-form";
import { IssueInvoiceAction } from "@/components/crm/issue-invoice-action";
import { PurchaseOrderAgreementAction } from "@/components/crm/purchase-order-agreement-action";
import { PurchaseOrderForm } from "@/components/crm/purchase-order-form";
import { PurchaseOrderWorkflowSection } from "@/components/crm/purchase-order-workflow-section";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Skeleton } from "@/components/ui/skeleton";
import { OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CRM_OPERATOR_ROLES, DEAL_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getCommunicationTimeline, getOpportunityDetail } from "@/lib/crm/data";
import { decorationMethodLabel, INVOICE_STATUS_LABEL, parseOpportunityDetailTab, PURCHASE_ORDER_STATUS_LABEL, STAGE_LABEL, type OpportunityDetailTab } from "@/lib/crm/constants";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { getActiveGarmentSizes, getCustomerFormOptions } from "@/lib/master-data";
import { parsePageParam } from "@/lib/pagination";

type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>;

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function documentRevisionLabel(revision: number) {
  return revision <= 1 ? "Dokumen awal" : `Revisi ${revision - 1}`;
}

export default async function OpportunityDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historyPage?: string | string[]; tab?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const historyPage = parsePageParam(resolvedSearchParams.historyPage);
  const initialTab = parseOpportunityDetailTab(resolvedSearchParams.tab);

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/crm" />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Kembali ke pipeline
      </Button>
      <Suspense fallback={<Skeleton className="h-16 w-full" />}>
        <OpportunityHeader id={id} />
      </Suspense>
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <OpportunityContent id={id} initialTab={initialTab} historyPage={historyPage} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg border" />}>
          <OpportunitySidebar id={id} />
        </Suspense>
      </div>
    </>
  );
}

async function OpportunityHeader({ id }: { id: string }) {
  const opportunity = await getOpportunityDetail(id);
  if (!opportunity) notFound();

  return (
    <PageHeader
      title={opportunity.title}
      description={
        <>
          {opportunity.opportunityNo} ·{" "}
          <Link href={`/customers/${opportunity.customer.id}`} className="underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {opportunity.customer.name}
          </Link>{" "}
          · Diperbarui {formatDate(opportunity.updatedAt, true)}
        </>
      }
      action={<OpportunityStatusBadge stage={opportunity.stage} className="h-7 px-3 text-sm" />}
    />
  );
}

async function OpportunityContent({ id, initialTab, historyPage }: { id: string; initialTab: OpportunityDetailTab; historyPage: number }) {
  const [opportunity, actor, formOptions, communicationHistory, sizeOptions] = await Promise.all([
    getOpportunityDetail(id),
    getCurrentActor(),
    getCustomerFormOptions(),
    getCommunicationTimeline({ opportunityId: id, page: historyPage }),
    getActiveGarmentSizes(),
  ]);
  if (!opportunity || !actor) notFound();
  if (historyPage > communicationHistory.pageCount) redirect(`/crm/peluang/${id}?tab=aktivitas&historyPage=${communicationHistory.pageCount}#communication-history`);

  const canOperate = hasRole(actor.role, CRM_OPERATOR_ROLES);
  const canCompleteDeal = hasRole(actor.role, DEAL_ROLES);
  const inNegotiation = opportunity.stage === "NEGOSIASI";
  const poDraft = opportunity.purchaseOrders.find((item) => item.status === "DRAFT");
  const agreedPo = opportunity.purchaseOrders.find((item) => item.status === "AGREED");
  const invoiceDraft = opportunity.invoices.find((item) => item.status === "DRAFT");
  const issuedInvoice = opportunity.invoices.find((item) => item.status === "ISSUED" && item.purchaseOrderId === agreedPo?.id);
  const readyForDeal = Boolean(agreedPo && issuedInvoice && !poDraft && !invoiceDraft);
  const poRevisionCount = Math.max(0, opportunity.purchaseOrders.length - 1);
  const poTabStatus = poDraft ? "Draft" : agreedPo ? "Disepakati" : poRevisionCount ? `${poRevisionCount} revisi` : opportunity.purchaseOrders.length ? "Dokumen awal" : "Belum ada";
  const invoiceTabStatus = invoiceDraft ? "Draft" : issuedInvoice ? "Terbit" : opportunity.invoices.length ? `${opportunity.invoices.length} revisi` : "Belum ada";
  const dealTabStatus = opportunity.stage === "DEAL" ? "Selesai" : opportunity.stage === "LOST" ? "Lost" : readyForDeal ? "Siap" : "Belum siap";
  const canShowPurchaseOrderAgreement = canOperate && inNegotiation && (Boolean(poDraft) || opportunity.purchaseOrders.length === 0);
  const canAgreePurchaseOrderDraft = Boolean(poDraft?.garmentType && poDraft.deadline && poDraft.sizes.length);

  return (
    <OpportunityProcessTabs
      initialTab={initialTab}
      status={{
        peluang: STAGE_LABEL[opportunity.stage],
        po: poTabStatus,
        invoice: invoiceTabStatus,
        deal: dealTabStatus,
        aktivitas: `${communicationHistory.total} entri`,
      }}
    >
      <OpportunityProcessPanel value="peluang">
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
      </OpportunityProcessPanel>

      <OpportunityProcessPanel value="po">
      <Card id="purchase-orders">
        <CardHeader>
          <CardTitle>Purchase Order customer</CardTitle>
          <CardDescription>Satu rantai revisi berisi bahan, desain, ukuran, dan jumlah yang disepakati.</CardDescription>
          {canShowPurchaseOrderAgreement ? (
            <CardAction className="w-full pl-0 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-3 max-sm:mt-3 max-sm:justify-self-stretch sm:w-auto sm:pl-4">
              {poDraft ? (
                <PurchaseOrderAgreementAction
                  opportunityId={opportunity.id}
                  purchaseOrderId={poDraft.id}
                  version={poDraft.version}
                  revisionLabel={documentRevisionLabel(poDraft.revision)}
                  canAgree={canAgreePurchaseOrderDraft}
                />
              ) : (
                <Button variant="outline" className="w-full sm:w-auto" disabled>
                  <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                  Sepakati PO
                </Button>
              )}
            </CardAction>
          ) : null}
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
                  <PurchaseOrderWorkflowSection
                    opportunityId={opportunity.id}
                    purchaseOrderId={purchaseOrder.id}
                    purchaseOrderVersion={purchaseOrder.version}
                    purchaseOrderRevision={purchaseOrder.revision}
                    purchaseOrderStatus={purchaseOrder.status}
                    title={`${purchaseOrder.purchaseOrderNo} · ${documentRevisionLabel(purchaseOrder.revision)}`}
                    description={`Dibuat ${formatDate(purchaseOrder.createdAt, true)} oleh ${purchaseOrder.createdBy.name}`}
                    canOperate={canOperate}
                    inNegotiation={inNegotiation}
                    hasActiveDraft={Boolean(poDraft)}
                    sizeOptions={sizeOptions}
                    draftValues={{
                      customerReference: purchaseOrder.customerReference ?? "",
                      garmentType: purchaseOrder.garmentType,
                      productName: purchaseOrder.productName,
                      material: purchaseOrder.material,
                      baseColor: purchaseOrder.baseColor ?? purchaseOrder.color ?? "",
                      variationColor: purchaseOrder.variationColor ?? "",
                      decorationMethod: purchaseOrder.decorationMethod ?? "",
                      orderDate: dateInputValue(purchaseOrder.orderDate),
                      sampleSize: purchaseOrder.sampleSize ?? "",
                      designNotes: purchaseOrder.designNotes ?? "",
                      notes: purchaseOrder.notes ?? "",
                      deadline: dateInputValue(purchaseOrder.deadline),
                      attachmentCount: purchaseOrder.attachments.length,
                      sizes: purchaseOrder.sizes,
                      roster: purchaseOrder.rosterEntries,
                    }}
                  >
                    <PurchaseOrderSnapshot purchaseOrder={purchaseOrder} />
                  </PurchaseOrderWorkflowSection>
                </section>
              ))}
              {canOperate && inNegotiation && opportunity.purchaseOrders.length === 0 ? <PurchaseOrderForm opportunityId={opportunity.id} sizeOptions={sizeOptions} /> : null}
            </div>
          )}
        </CardContent>
      </Card>
      </OpportunityProcessPanel>

      <OpportunityProcessPanel value="invoice">
      <Card id="invoices">
        <CardHeader>
          <CardTitle>Invoice konveksi</CardTitle>
          <CardDescription>Harga mengikuti ukuran dan jumlah pada PO Disepakati.</CardDescription>
          {invoiceDraft && canOperate && inNegotiation && agreedPo ? (
            <CardAction className="w-full pl-0 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-3 max-sm:mt-3 max-sm:justify-self-stretch sm:w-auto sm:pl-4">
              <IssueInvoiceAction
                opportunityId={opportunity.id}
                invoiceId={invoiceDraft.id}
                version={invoiceDraft.version}
              />
            </CardAction>
          ) : null}
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
              {canOperate && inNegotiation && agreedPo && !invoiceDraft && !issuedInvoice ? (
                <InvoiceForm
                  opportunityId={opportunity.id}
                  purchaseOrder={agreedPo}
                />
              ) : null}
              {opportunity.invoices.map((invoice) => {
                const invoicePo = opportunity.purchaseOrders.find((item) => item.id === invoice.purchaseOrderId);
                const editableInvoicePo = invoice.purchaseOrderId === agreedPo?.id ? agreedPo : null;
                const invoiceDraftValues = {
                  dueAt: dateInputValue(invoice.dueAt),
                  notes: invoice.notes ?? "",
                  taxRate: invoice.items[0]?.taxRate.toString() ?? "0",
                  items: invoice.items.map((item) => ({
                    size: item.size,
                    sleeveLength: item.sleeveLength,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                    discountPercent: item.discountPercent.toString(),
                  })),
                };
                return (
                  <section key={invoice.id} aria-labelledby={`invoice-${invoice.id}`} className="rounded-lg border p-4">
                    <InvoiceWorkflowSection
                      opportunityId={opportunity.id}
                      invoiceId={invoice.id}
                      invoiceVersion={invoice.version}
                      invoiceRevision={invoice.revision}
                      invoiceStatus={invoice.status}
                      title={`${invoice.invoiceNo} · ${documentRevisionLabel(invoice.revision)}`}
                      description={`Berdasarkan ${invoicePo?.purchaseOrderNo ?? "PO"} · Dibuat ${formatDate(invoice.createdAt, true)}`}
                      canOperate={canOperate}
                      inNegotiation={inNegotiation}
                      hasActiveDraft={Boolean(invoiceDraft)}
                      canCreateRevision={invoice.status === "ISSUED" && invoice.purchaseOrderId === agreedPo?.id}
                      purchaseOrder={editableInvoicePo}
                      draftValues={invoiceDraftValues}
                      salesOrderHref={invoice.salesOrder ? `/sales-orders/${invoice.salesOrder.id}` : undefined}
                      salesOrderLabel={invoice.salesOrder ? `Lihat ${invoice.salesOrder.salesOrderNo}` : undefined}
                    >
                      <InvoiceSnapshot invoice={invoice} />
                    </InvoiceWorkflowSection>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </OpportunityProcessPanel>

      <OpportunityProcessPanel value="deal">
        <Card id="complete-deal">
          <CardHeader>
            <CardTitle>Deal dan Sales Order</CardTitle>
            <CardDescription>Periksa kesiapan dokumen sebelum Admin mengonfirmasi pembayaran dan membentuk Sales Order.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {inNegotiation && canCompleteDeal && readyForDeal && agreedPo && issuedInvoice ? (
              <DealPaymentForm opportunityId={opportunity.id} opportunityVersion={opportunity.version} purchaseOrderId={agreedPo.id} invoiceId={issuedInvoice.id} invoiceVersion={issuedInvoice.version} total={issuedInvoice.total.toString()} initialPaidAt={toDateTimeLocalValue(new Date())} />
            ) : opportunity.stage === "DEAL" ? (
              <Alert>
                <AlertTitle>Peluang sudah Deal</AlertTitle>
                <AlertDescription>Sales Order yang terbentuk tersedia pada ringkasan di bawah.</AlertDescription>
              </Alert>
            ) : opportunity.stage === "LOST" ? (
              <Alert>
                <AlertTitle>Peluang berstatus Lost</AlertTitle>
                <AlertDescription>Proses Deal tidak tersedia karena peluang telah dibatalkan.</AlertDescription>
              </Alert>
            ) : !inNegotiation ? (
              <Alert>
                <AlertTitle>Negosiasi belum dimulai</AlertTitle>
                <AlertDescription>Pindahkan peluang ke Negosiasi sebelum menyusun PO, invoice, dan pembayaran.</AlertDescription>
              </Alert>
            ) : readyForDeal ? (
              <Alert>
                <AlertTitle>Menunggu konfirmasi Admin</AlertTitle>
                <AlertDescription>PO dan invoice sudah siap. Hanya Admin yang dapat mengonfirmasi pembayaran dan membentuk Sales Order.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>Dokumen belum lengkap</AlertTitle>
                <AlertDescription>
                  PO harus berstatus Disepakati dan invoice terkait harus berstatus Terbit. Saat ini PO: {poTabStatus}; invoice: {invoiceTabStatus}.
                </AlertDescription>
              </Alert>
            )}
            {opportunity.salesOrders.length ? (
              <section aria-labelledby="deal-sales-orders" className="flex flex-col gap-3">
                <div>
                  <h3 id="deal-sales-orders" className="font-medium">Sales Order terbentuk</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Buka dokumen untuk melihat pembayaran dan progres order.</p>
                </div>
                {opportunity.salesOrders.map((order) => (
                  <div key={order.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/sales-orders/${order.id}`} className="font-mono text-sm font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {order.salesOrderNo}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(order.total)} · {order.payment?.kind ?? "-"}</p>
                    </div>
                    <SalesOrderStatusBadge status={order.status} />
                  </div>
                ))}
              </section>
            ) : null}
          </CardContent>
        </Card>
      </OpportunityProcessPanel>

      <OpportunityProcessPanel value="aktivitas">
      <CommunicationHistory
        items={communicationHistory.items}
        total={communicationHistory.total}
        page={communicationHistory.page}
        pageCount={communicationHistory.pageCount}
        pathname={`/crm/peluang/${opportunity.id}`}
        paginationParams={{ tab: "aktivitas" }}
        form={canOperate && !opportunity.customer.archivedAt ? <CommunicationEntryForm context="opportunity" customerId={opportunity.customer.id} opportunityId={opportunity.id} initialOccurredAt={toDateTimeLocalValue(new Date())} /> : undefined}
      />
      </OpportunityProcessPanel>
    </OpportunityProcessTabs>
  );
}

async function OpportunitySidebar({ id }: { id: string }) {
  const [opportunity, actor] = await Promise.all([
    getOpportunityDetail(id),
    getCurrentActor(),
  ]);
  if (!opportunity || !actor) notFound();

  const canOperate = hasRole(actor.role, CRM_OPERATOR_ROLES);

  return (
    <aside className="flex flex-col self-start gap-5 xl:mt-[4.75rem]">
      {canOperate ? (
        <Card>
          <CardHeader><CardTitle>Status pipeline</CardTitle><CardDescription>Tentukan langkah kerja berikutnya.</CardDescription></CardHeader>
          <CardContent><OpportunityStageForm opportunityId={opportunity.id} version={opportunity.version} initialStage={opportunity.stage} cancelReason={opportunity.cancelReason} /></CardContent>
        </Card>
      ) : null}
    </aside>
  );
}

function OpportunityReadOnly({ opportunity }: { opportunity: OpportunityDetail }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Produk awal</dt><dd className="mt-1">{opportunity.productName ?? "-"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">PIC sales</dt><dd className="mt-1">{opportunity.salesPic?.name ?? "-"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Spesifikasi awal</dt><dd className="mt-1 whitespace-pre-wrap">{opportunity.specification ?? "-"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Next action</dt><dd className="mt-1">{opportunity.nextAction ? `${opportunity.nextAction} · ${formatDate(opportunity.nextActionAt, true)}` : "-"}</dd></div>
    </dl>
  );
}

function PurchaseOrderSnapshot({ purchaseOrder }: { purchaseOrder: OpportunityDetail["purchaseOrders"][number] }) {
  const total = purchaseOrder.sizes.reduce((sum, item) => sum + item.quantity, 0);
  const sizeNames = [...new Set(purchaseOrder.sizes.map((item) => item.size))];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1">{PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Referensi customer</dt><dd className="mt-1">{purchaseOrder.customerReference ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Jenis pakaian</dt><dd className="mt-1">{purchaseOrder.garmentType === "JERSEY" ? "Jersey" : purchaseOrder.garmentType === "NON_JERSEY" ? "Non-jersey" : "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Produk atau pola</dt><dd className="mt-1">{purchaseOrder.productName}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Bahan</dt><dd className="mt-1">{purchaseOrder.material}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Warna dasar</dt><dd className="mt-1">{purchaseOrder.baseColor ?? purchaseOrder.color ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Warna variasi</dt><dd className="mt-1">{purchaseOrder.variationColor ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Metode dekorasi</dt><dd className="mt-1">{decorationMethodLabel(purchaseOrder.decorationMethod)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Deadline produksi</dt><dd className="mt-1">{formatDate(purchaseOrder.deadline)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total jumlah</dt><dd className="mt-1 font-mono">{total}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan desain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.designNotes ?? "-"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan lain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.notes ?? "-"}</dd></div>
      </dl>
      <Table containerClassName="rounded-lg border">
        <TableHeader><TableRow><TableHead>Model</TableHead>{sizeNames.map((size) => <TableHead key={size} className="text-center">{size}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>{(["PENDEK", "PANJANG"] as const).map((sleeve) => { const rows = purchaseOrder.sizes.filter((item) => item.sleeveLength === sleeve); return <TableRow key={sleeve}><TableCell>{sleeve === "PENDEK" ? "Pendek" : "Panjang"}</TableCell>{sizeNames.map((size) => <TableCell key={size} className="text-center font-mono">{rows.find((item) => item.size === size)?.quantity ?? 0}</TableCell>)}<TableCell className="text-right font-mono">{rows.reduce((sum, item) => sum + item.quantity, 0)}</TableCell></TableRow>; })}</TableBody>
      </Table>
      {purchaseOrder.rosterEntries.length ? <div><p className="mb-2 text-sm font-medium">Roster pemakai ({purchaseOrder.rosterEntries.length})</p><Table containerClassName="max-h-96 rounded-lg border"><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nama</TableHead><TableHead>Ukuran</TableHead></TableRow></TableHeader><TableBody>{purchaseOrder.rosterEntries.slice(0, 50).map((entry) => <TableRow key={entry.id}><TableCell className="font-mono">{entry.memberId}</TableCell><TableCell>{entry.name}</TableCell><TableCell>{entry.size}</TableCell></TableRow>)}</TableBody></Table>{purchaseOrder.rosterEntries.length > 50 ? <p className="mt-2 text-xs text-muted-foreground">Menampilkan 50 baris pertama. Seluruh roster tersedia di PDF PO.</p> : null}</div> : null}
      {purchaseOrder.attachments.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {purchaseOrder.attachments.map((attachment) => (
            <Button
              key={attachment.id}
              size="sm"
              variant="outline"
              className="h-auto min-h-9 max-w-full shrink justify-start whitespace-normal py-2 text-left leading-5"
              render={<Link href={`/api/crm/purchase-order/${purchaseOrder.id}/attachments/${attachment.id}`} />}
              nativeButton={false}
            >
              <Paperclip data-icon="inline-start" aria-hidden="true" />
              <span className="min-w-0">{attachment.originalName}</span>
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
        <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Diskon</TableHead><TableHead className="text-right">Pajak</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
        <TableBody>{invoice.items.map((item) => <TableRow key={item.id}><TableCell>{item.productName ?? "Produk"}</TableCell><TableCell>{item.description}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.discountAmount)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.taxAmount)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.total)}</TableCell></TableRow>)}</TableBody>
      </Table>
      <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(invoice.subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{formatCurrency(invoice.totalDiscount)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pajak</dt><dd className="font-mono">{formatCurrency(invoice.totalTax)}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-2 font-medium"><dt>Total</dt><dd className="font-mono">{formatCurrency(invoice.total)}</dd></div>
      </dl>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1">{INVOICE_STATUS_LABEL[invoice.status]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Diterbitkan</dt><dd className="mt-1">{formatDate(invoice.issuedAt, true)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Jatuh tempo</dt><dd className="mt-1">{formatDate(invoice.dueAt)}</dd></div>
        {invoice.notes ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan</dt><dd className="mt-1 whitespace-pre-wrap">{invoice.notes}</dd></div> : null}
      </dl>
    </div>
  );
}
