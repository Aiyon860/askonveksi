import Link from "next/link";
import { Fragment, Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileDown, FileText, Paperclip } from "lucide-react";

import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
import { CommunicationHistory } from "@/components/crm/communication-history";
import { InvoiceForm } from "@/components/crm/invoice-form";
import { InvoiceWorkflowSection } from "@/components/crm/invoice-workflow-section";
import { OpportunityProcessPanel, OpportunityProcessTabs } from "@/components/crm/opportunity-process-tabs";
import { IssueInvoiceAction } from "@/components/crm/issue-invoice-action";
import { PurchaseOrderAgreementAction } from "@/components/crm/purchase-order-agreement-action";
import { PurchaseOrderForm } from "@/components/crm/purchase-order-form";
import { PurchaseOrderWorkflowSection } from "@/components/crm/purchase-order-workflow-section";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Skeleton } from "@/components/ui/skeleton";
import { OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CRM_OPERATOR_ROLES, DESIGN_UPLOADER_ROLES, OWNER_ACTION_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getCommunicationTimeline, getOpportunityDetail, getPurchaseOrderNoPreview } from "@/lib/crm/data";
import { decorationMethodsLabel, DESIGN_REVISION_LIMIT, GARMENT_TYPE_LABEL, INVOICE_STATUS_LABEL, parseOpportunityDetailTab, PURCHASE_ORDER_STATUS_LABEL, type OpportunityDetailTab } from "@/lib/crm/constants";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { getActiveGarmentSizes, getActivePaymentMethods, getActiveProductCategories } from "@/lib/master-data";
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
    <div className="flex min-w-0 max-w-full flex-col gap-6 overflow-x-clip">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/crm" />} nativeButton={false} className="w-fit">
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Kembali ke pipeline
        </Button>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <OpportunityHeader id={id} />
        </Suspense>
      </div>
      <PageMessage />
      <AutoRefresh />

      <div className="flex min-w-0 max-w-full flex-col">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <OpportunityContent id={id} initialTab={initialTab} historyPage={historyPage} />
        </Suspense>
      </div>
    </div>
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
  const [opportunity, actor, communicationHistory, sizeOptions, categoryOptions, paymentMethods] = await Promise.all([
    getOpportunityDetail(id),
    getCurrentActor(),
    getCommunicationTimeline({ opportunityId: id, page: historyPage }),
    getActiveGarmentSizes(),
    getActiveProductCategories(),
    getActivePaymentMethods(),
  ]);
  if (!opportunity || !actor) notFound();
  const purchaseOrderNoPreview = await getPurchaseOrderNoPreview(opportunity.customer);
  if (historyPage > communicationHistory.pageCount) redirect(`/crm/peluang/${id}?tab=aktivitas&historyPage=${communicationHistory.pageCount}#communication-history`);

  const canOperate = hasRole(actor.role, CRM_OPERATOR_ROLES);
  // D1: Admin PO boleh mengunggah desain langsung (read-only CRM lainnya tetap).
  const canUploadDesignRole = hasRole(actor.role, DESIGN_UPLOADER_ROLES);
  const canCancelDocuments = hasRole(actor.role, OWNER_ACTION_ROLES);
  const inNegotiation = opportunity.stage === "NEGOSIASI";
  const poDraft = opportunity.purchaseOrders.find((item) => item.status === "DRAFT");
  const agreedPo = opportunity.purchaseOrders.find((item) => item.status === "AGREED");
  // Objek PO mentah mengandung Decimal (mis. deposit.amount) yang tidak boleh
  // dikirim sebagai prop ke Client Component; form invoice hanya butuh field ini.
  const invoicePo = agreedPo
    ? {
        id: agreedPo.id,
        purchaseOrderNo: agreedPo.purchaseOrderNo,
        productName: agreedPo.productName,
        garmentType: agreedPo.garmentType,
        items: agreedPo.items.map((item) => ({ id: item.id, name: item.name, garmentType: item.garmentType })),
        sizes: agreedPo.sizes.map((size) => ({ id: size.id, itemId: size.itemId, size: size.size, sleeveLength: size.sleeveLength, quantity: size.quantity })),
        depositAmount: agreedPo.deposit ? agreedPo.deposit.amount.toString() : null,
      }
    : undefined;
  const cancelledPo = opportunity.purchaseOrders.find((item) => item.status === "CANCELLED");
  const invoiceDraft = opportunity.invoices.find((item) => item.status === "DRAFT");
  const cancelledInvoice = opportunity.invoices.find((item) => item.status === "CANCELLED");
  const issuedInvoice = opportunity.invoices.find((item) => item.status === "ISSUED" && item.purchaseOrderId === agreedPo?.id);
  const scheduledPayment = issuedInvoice?.pendingPayment;
  const readyForDeal = Boolean(agreedPo && issuedInvoice && !poDraft && !invoiceDraft);
  const poRevisionCount = Math.max(0, opportunity.purchaseOrders.length - 1);
  const poTabStatus = poDraft ? "Draft" : agreedPo ? "Disepakati" : cancelledPo ? "Dibatalkan" : poRevisionCount ? `${poRevisionCount} revisi` : opportunity.purchaseOrders.length ? "Dokumen awal" : "Belum ada";
  const invoiceTabStatus = invoiceDraft ? "Draft" : issuedInvoice ? "Terbit" : cancelledInvoice ? "Dibatalkan" : opportunity.invoices.length ? `${opportunity.invoices.length} revisi` : "Belum ada";
  const canShowPurchaseOrderAgreement = canOperate && inNegotiation && (Boolean(poDraft) || opportunity.purchaseOrders.length === 0);
  // Desain diunggah per produk; PO lama tanpa baris produk memakai satu produk implisit.
  const designRevisionByItem = new Map<string, number>();
  for (const revision of poDraft?.designTask?.revisions ?? []) {
    designRevisionByItem.set(revision.itemId, Math.max(designRevisionByItem.get(revision.itemId) ?? 0, revision.revision));
  }
  const designItemSources = poDraft
    ? poDraft.items.length
      ? poDraft.items.map((item) => ({ id: item.id, name: item.name }))
      : [{ id: "", name: poDraft.productName }]
    : [];
  const designItems = designItemSources.map((item) => ({ ...item, revisionCount: designRevisionByItem.get(item.id) ?? 0 }));
  const designUploadedCount = designItems.filter((item) => item.revisionCount > 0).length;
  const designMessage = !poDraft?.designTask
    ? "Tugas desain belum tersedia."
    : designItems.length > 0 && designItems.every((item) => item.revisionCount >= DESIGN_REVISION_LIMIT)
      ? `Batas ${DESIGN_REVISION_LIMIT} versi desain tercapai. Buat revisi PO untuk membuka versi baru.`
      : designUploadedCount > 0 && designUploadedCount < designItems.length
        ? `Desain terunggah untuk ${designUploadedCount}/${designItems.length} produk. Lengkapi sisanya bila sudah siap.`
        : "Unggah desain bila sudah tersedia.";
  const canAgreePurchaseOrderDraft = Boolean(poDraft?.garmentType && poDraft.deadline && poDraft.sizes.length && designItems.length > 0 && designUploadedCount === designItems.length);
  const depositForDraft = poDraft?.deposit
    ? {
        amount: poDraft.deposit.amount.toString(),
        paidAt: poDraft.deposit.paidAt,
        paymentMethodId: poDraft.deposit.paymentMethodId,
        reference: poDraft.deposit.reference,
        note: poDraft.deposit.note,
        proofFileName: poDraft.deposit.proofFileName,
        proofMimeType: poDraft.deposit.proofMimeType,
      }
    : null;

  return (
    <OpportunityProcessTabs
      initialTab={initialTab}
      status={{
        po: poTabStatus,
        invoice: invoiceTabStatus,
        aktivitas: `${communicationHistory.total} entri`,
      }}
    >
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
                  designMessage={designMessage}
                  designSentAt={poDraft.designSentAt}
                  designSentByName={poDraft.designSentBy?.name ?? null}
                  designTaskId={poDraft.designTask?.id ?? null}
                  designItems={designItems}
                  depositRequired={poDraft.depositRequired}
                  deposit={depositForDraft}
                  depositMethods={paymentMethods}
                  canEditDeposit={canOperate && poDraft.status === "DRAFT"}
                  canUploadDesign={canUploadDesignRole}
                />
              ) : (
                <Button variant="outline" className="w-full sm:w-auto" disabled>
                  <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                  Sepakati PO terbaru
                </Button>
              )}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          {!inNegotiation && opportunity.purchaseOrders.length === 0 ? (
            <Empty className="p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>PO belum diperlukan</EmptyTitle>
                <EmptyDescription>Data PO baru tersedia saat peluang masuk ke Negosiasi.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex min-w-0 max-w-full flex-col gap-6">
              {opportunity.purchaseOrders.map((purchaseOrder) => (
                <section key={purchaseOrder.id} aria-labelledby={`po-${purchaseOrder.id}`} className="min-w-0 rounded-lg border p-4">
                  <PurchaseOrderWorkflowSection
                    opportunityId={opportunity.id}
                    purchaseOrderId={purchaseOrder.id}
                    purchaseOrderVersion={purchaseOrder.version}
                    purchaseOrderRevision={purchaseOrder.revision}
                    purchaseOrderStatus={purchaseOrder.status}
                    title={`${purchaseOrder.purchaseOrderNo} · ${documentRevisionLabel(purchaseOrder.revision)}`}
                    description={`Dibuat ${formatDate(purchaseOrder.createdAt, true)} oleh ${purchaseOrder.createdBy.name}`}
                    canOperate={canOperate}
                    canCancel={canCancelDocuments}
                    inNegotiation={inNegotiation}
                    sizeOptions={sizeOptions}
                    categoryOptions={categoryOptions}
                    draftValues={(() => {
                      const poItems = purchaseOrder.items.length ? purchaseOrder.items : [{
                        id: "",
                        position: 0,
                        name: purchaseOrder.productName,
                        pola: purchaseOrder.pola ?? "",
                        productCategoryId: purchaseOrder.productCategoryId,
                        decorationMethods: purchaseOrder.decorationMethods.length ? purchaseOrder.decorationMethods : (purchaseOrder.decorationMethod ? [purchaseOrder.decorationMethod] : []),
                        designNotes: purchaseOrder.designNotes ?? "",
                      }];
                      return {
                        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
                        garmentType: purchaseOrder.garmentType,
                        productCategoryId: purchaseOrder.productCategoryId,
                        instansi: purchaseOrder.instansi ?? "",
                        material: purchaseOrder.material,
                        baseColor: purchaseOrder.baseColor ?? purchaseOrder.color ?? "",
                        variationColor: purchaseOrder.variationColor ?? "",
                        orderDate: dateInputValue(purchaseOrder.orderDate),
                        sampleSize: purchaseOrder.sampleSize ?? "",
                        designNotes: purchaseOrder.designNotes ?? "",
                        notes: purchaseOrder.notes ?? "",
                        deadline: dateInputValue(purchaseOrder.deadline),
                        designDeadline: dateInputValue(purchaseOrder.designTask?.deadline ?? null),
                        depositRequired: purchaseOrder.depositRequired,
                        items: poItems.map((poItem, itemIndex) => {
                          const itemSizes = purchaseOrder.sizes.filter((size) => !purchaseOrder.items.length || size.itemId === poItem.id);
                          const itemRoster = purchaseOrder.rosterEntries.filter((entry) => !purchaseOrder.items.length || entry.itemId === poItem.id);
                          const matrix: Record<string, number> = {};
                          for (const row of itemSizes) {
                            const key = `${row.sleeveLength}:${row.sizeId ?? row.size.toLocaleLowerCase("id-ID")}`;
                            matrix[key] = Math.max(0, Math.trunc(row.quantity));
                          }
                          const accessoryQuantity = purchaseOrder.garmentType === "AKSESORI"
                            ? String(itemSizes.reduce((sum, row) => sum + Math.max(0, Math.trunc(row.quantity)), 0) || "")
                            : "";
                          return {
                            key: poItem.id || `saved-${itemIndex}`,
                            name: poItem.name,
                            pola: poItem.pola ?? purchaseOrder.pola ?? "",
                            productCategoryId: poItem.productCategoryId ?? "",
                            decorationMethods: poItem.decorationMethods,
                            designNotes: poItem.designNotes ?? "",
                            matrix,
                            rosterMode: (itemRoster.length ? "manual" : "none") as "none" | "manual" | "excel",
                            roster: itemRoster.map((entry, entryIndex) => ({
                              key: `saved-${entryIndex}-${entry.memberId}`,
                              memberId: entry.memberId,
                              name: entry.name,
                              sizeId: entry.sizeId ?? "",
                              sleeveLength: entry.sleeveLength,
                            })),
                            accessoryQuantity,
                          };
                        }),
                      };
                    })()}
                    purchaseOrderNoPreview={purchaseOrderNoPreview}
                    defaultInstansi={opportunity.customer.companyName ?? opportunity.customer.name}
                    penjahitItems={purchaseOrder.items.map((item) => ({
                      id: item.id,
                      name: item.name,
                      deadline: dateInputValue(item.penjahitDeadline) || null,
                      hasDesign: Boolean(item.penjahitDesignPath),
                      designName: item.penjahitDesignName,
                    }))}
                  >
                    <PurchaseOrderSnapshot purchaseOrder={purchaseOrder} />
                  </PurchaseOrderWorkflowSection>
                </section>
              ))}
              {canOperate && inNegotiation && opportunity.purchaseOrders.length === 0 ? <PurchaseOrderForm opportunityId={opportunity.id} sizeOptions={sizeOptions} categoryOptions={categoryOptions} purchaseOrderNoPreview={purchaseOrderNoPreview} defaultInstansi={opportunity.customer.companyName ?? opportunity.customer.name} /> : null}
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
            <div className="flex min-w-0 max-w-full flex-col gap-6">
              {canOperate && inNegotiation && agreedPo && invoicePo && !invoiceDraft && !issuedInvoice ? (
                <InvoiceForm
                  opportunityId={opportunity.id}
                  purchaseOrder={invoicePo}
                />
              ) : null}
              {opportunity.invoices.map((invoice) => {
                const invoiceSourcePo = opportunity.purchaseOrders.find((item) => item.id === invoice.purchaseOrderId);
                const editableInvoicePo = invoice.purchaseOrderId === agreedPo?.id ? (invoicePo ?? null) : null;
                // Kwitansi tersedia untuk pembayaran yang sudah dibayar (awal + termin).
                const invoiceReceipts = invoice.salesOrder?.payment
                  ? [
                      ...(invoice.salesOrder.payment.transactions[0] ? [{ id: invoice.salesOrder.payment.transactions[0].id, label: "Lihat Kwitansi" }] : []),
                      ...invoice.salesOrder.payment.terms.flatMap((term) => (term.transactions[0] ? [{ id: term.transactions[0].id, label: `Lihat Kwitansi Termin ${term.position + 1}` }] : [])),
                    ]
                  : [];
                const invoiceDraftValues = {
                  notes: invoice.notes ?? "",
                  dueAt: invoice.dueAt?.toISOString().slice(0, 10) ?? "",
                  schedule: invoice.pendingPayment
                    ? {
                        kind: invoice.pendingPayment.kind,
                        initialValueType: invoice.pendingPayment.initialValueType,
                        initialValue: invoice.pendingPayment.initialValue.toString(),
                        initialDueAt: invoice.pendingPayment.initialDueAt?.toISOString().slice(0, 10) ?? "",
                        terms: invoice.pendingPayment.terms.map((term) => ({ value: term.value.toString(), dueAt: term.dueAt?.toISOString().slice(0, 10) ?? "" })),
                      }
                    : undefined,
                  discountType: invoice.discountType,
                  discountPercent: invoice.discountValue.toString(),
                  discountNominal: invoice.discountNominal.toString(),
                  taxPercent: invoice.taxPercent?.toString() ?? "0",
                  items: invoice.items.map((item) => ({
                    productName: item.productName ?? "",
                    description: item.description,
                    size: item.size,
                    sleeveLength: item.sleeveLength,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                    discountType: item.discountType,
                    discountPercent: item.discountPercent?.toString() ?? "0",
                    discountNominal: item.discountAmount?.toString() ?? "0",
                    addons: item.addons.map((addon) => ({ label: addon.label, description: addon.description ?? "", amount: addon.unitAmount.toString(), qty: addon.qty })),
                  })),
                };
                return (
                  <section key={invoice.id} aria-labelledby={`invoice-${invoice.id}`} className="min-w-0 rounded-lg border p-4">
                    <InvoiceWorkflowSection
                      opportunityId={opportunity.id}
                      invoiceId={invoice.id}
                      invoiceVersion={invoice.version}
                      invoiceRevision={invoice.revision}
                      invoiceStatus={invoice.status}
                      title={`${invoice.invoiceNo} · ${documentRevisionLabel(invoice.revision)}`}
                      description={`Berdasarkan ${invoiceSourcePo?.purchaseOrderNo ?? "PO"} · Dibuat ${formatDate(invoice.createdAt, true)}`}
                      canOperate={canOperate}
                      canCancel={canCancelDocuments}
                      inNegotiation={inNegotiation}
                      purchaseOrder={editableInvoicePo}
                      draftValues={invoiceDraftValues}
                      salesOrderHref={invoice.salesOrder ? `/sales-orders/${invoice.salesOrder.id}` : undefined}
                      salesOrderLabel={invoice.salesOrder ? `Lihat ${invoice.salesOrder.salesOrderNo}` : undefined}
                      receipts={invoiceReceipts}
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

        <Card id="complete-deal">
          <CardHeader>
            <CardTitle>Deal dan Sales Order</CardTitle>
            <CardDescription>Periksa kesiapan dokumen sebelum Admin mengonfirmasi pembayaran dan membentuk Sales Order.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 max-w-full flex-col gap-6">
            {opportunity.stage === "DEAL" ? (
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
            ) : scheduledPayment ? (
              <Alert variant="success">
                <AlertTitle>Jadwal pembayaran sudah tersimpan</AlertTitle>
                <AlertDescription>Pembayaran awal {scheduledPayment.kind === "LUNAS" ? "Lunas" : scheduledPayment.kind === "DEPOSIT" ? "Deposit" : "DP"} sudah dijadwalkan. Catat pembayaran awal dari Detail Invoice untuk membentuk Sales Order dan Work Order.</AlertDescription>
              </Alert>
            ) : readyForDeal ? (
              <Alert>
                <AlertTitle>Jadwal pembayaran belum tersedia</AlertTitle>
                <AlertDescription>Invoice ini terbit tanpa jadwal pembayaran. Jadwal DP/Lunas disimpan bersama draft invoice melalui satu tombol simpan sebelum diterbitkan.</AlertDescription>
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

function PurchaseOrderSnapshot({ purchaseOrder }: { purchaseOrder: OpportunityDetail["purchaseOrders"][number] }) {
  const total = purchaseOrder.sizes.reduce((sum, item) => sum + item.quantity, 0);
  const isAccessory = purchaseOrder.garmentType === "AKSESORI";
  const sizeNames = [...new Set(purchaseOrder.sizes.map((item) => item.size))];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1">{PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Jenis pakaian</dt><dd className="mt-1">{purchaseOrder.garmentType ? GARMENT_TYPE_LABEL[purchaseOrder.garmentType] : "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Kategori</dt><dd className="mt-1">{purchaseOrder.productCategory?.name ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Instansi</dt><dd className="mt-1">{purchaseOrder.instansi ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Pola</dt><dd className="mt-1">{purchaseOrder.items.length ? purchaseOrder.items.map((poItem) => `${poItem.name}: ${poItem.pola ?? purchaseOrder.pola ?? "-"}`).join(" · ") : purchaseOrder.pola ?? purchaseOrder.productName ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Bahan</dt><dd className="mt-1">{purchaseOrder.material}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Warna dasar</dt><dd className="mt-1">{purchaseOrder.baseColor ?? purchaseOrder.color ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Warna variasi</dt><dd className="mt-1">{purchaseOrder.variationColor ?? "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Deposit</dt><dd className="mt-1">{purchaseOrder.depositRequired ? "Perlu deposit" : "Tanpa deposit"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Metode dekorasi</dt><dd className="mt-1">{purchaseOrder.items.length ? purchaseOrder.items.map((poItem) => `${poItem.name}: ${decorationMethodsLabel(poItem.decorationMethods)}`).join(" · ") : decorationMethodsLabel(purchaseOrder.decorationMethods.length ? purchaseOrder.decorationMethods : (purchaseOrder.decorationMethod ? [purchaseOrder.decorationMethod] : []))}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Deadline produksi</dt><dd className="mt-1">{formatDate(purchaseOrder.deadline)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total jumlah</dt><dd className="mt-1 font-mono">{total}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan desain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.designNotes ?? "-"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan lain</dt><dd className="mt-1 whitespace-pre-wrap">{purchaseOrder.notes ?? "-"}</dd></div>
      </dl>
      {purchaseOrder.items.length > 1 ? (
        <div className="flex flex-col gap-4">
          {purchaseOrder.items.map((poItem) => {
            const itemSizes = purchaseOrder.sizes.filter((row) => row.itemId === poItem.id);
            const itemSizeNames = [...new Set(itemSizes.map((row) => row.size))];
            const itemTotal = itemSizes.reduce((sum, row) => sum + row.quantity, 0);
            const itemIsAccessory = (poItem.garmentType ?? purchaseOrder.garmentType) === "AKSESORI";
            return (
              <div key={poItem.id} className="rounded-lg border-2 border-primary/25 bg-primary/[0.04] p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{poItem.name}</span>
                  <span className="text-xs text-muted-foreground">{decorationMethodsLabel(poItem.decorationMethods)} · Total {itemTotal.toLocaleString("id-ID")}</span>
                </div>
                {itemIsAccessory ? (
                  <p className="text-sm">Jumlah produk: <span className="font-mono">{itemTotal.toLocaleString("id-ID")}</span></p>
                ) : (
                <Table containerClassName="rounded-lg border">
                  <TableHeader><TableRow><TableHead>Model</TableHead>{itemSizeNames.map((size) => <TableHead key={size} className="text-center">{size}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>{(["PENDEK", "PANJANG"] as const).map((sleeve) => { const rows = itemSizes.filter((row) => row.sleeveLength === sleeve); return <TableRow key={sleeve}><TableCell>{sleeve === "PENDEK" ? "Pendek" : "Panjang"}</TableCell>{itemSizeNames.map((size) => <TableCell key={size} className="text-center font-mono">{rows.find((row) => row.size === size)?.quantity ?? 0}</TableCell>)}<TableCell className="text-right font-mono">{rows.reduce((sum, row) => sum + row.quantity, 0)}</TableCell></TableRow>; })}</TableBody>
                </Table>
                )}
              </div>
            );
          })}
        </div>
      ) : isAccessory ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Jumlah produk</dt><dd className="mt-1 font-mono">{total.toLocaleString("id-ID")}</dd></div>
        </dl>
      ) : (
      <Table containerClassName="rounded-lg border">
        <TableHeader><TableRow><TableHead>Model</TableHead>{sizeNames.map((size) => <TableHead key={size} className="text-center">{size}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>{(["PENDEK", "PANJANG"] as const).map((sleeve) => { const rows = purchaseOrder.sizes.filter((item) => item.sleeveLength === sleeve); return <TableRow key={sleeve}><TableCell>{sleeve === "PENDEK" ? "Pendek" : "Panjang"}</TableCell>{sizeNames.map((size) => <TableCell key={size} className="text-center font-mono">{rows.find((item) => item.size === size)?.quantity ?? 0}</TableCell>)}<TableCell className="text-right font-mono">{rows.reduce((sum, item) => sum + item.quantity, 0)}</TableCell></TableRow>; })}</TableBody>
      </Table>
      )}
      {purchaseOrder.rosterEntries.length ? <div><p className="mb-2 text-sm font-medium">Roster pemakai ({purchaseOrder.rosterEntries.length})</p><Table containerClassName="max-h-96 rounded-lg border"><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nama</TableHead>{purchaseOrder.items.length > 1 ? <TableHead>Produk</TableHead> : null}<TableHead>Ukuran</TableHead><TableHead>Lengan</TableHead></TableRow></TableHeader><TableBody>{purchaseOrder.rosterEntries.slice(0, 50).map((entry) => <TableRow key={entry.id}><TableCell className="font-mono">{entry.memberId}</TableCell><TableCell>{entry.name}</TableCell>{purchaseOrder.items.length > 1 ? <TableCell>{purchaseOrder.items.find((poItem) => poItem.id === entry.itemId)?.name ?? "-"}</TableCell> : null}<TableCell>{entry.size}</TableCell><TableCell>{entry.sleeveLength === "PENDEK" ? "Pendek" : "Panjang"}</TableCell></TableRow>)}</TableBody></Table>{purchaseOrder.rosterEntries.length > 50 ? <p className="mt-2 text-xs text-muted-foreground">Menampilkan 50 baris pertama. Seluruh roster tersedia di PDF PO.</p> : null}</div> : null}
      {purchaseOrder.attachments.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {purchaseOrder.attachments.map((attachment) => (
            <Button
              key={attachment.id}
              size="sm"
              variant="outline"
              className="h-auto min-h-9 max-w-full shrink justify-start whitespace-normal py-2 text-left leading-5"
              render={<a href={`/api/crm/purchase-order/${purchaseOrder.id}/attachments/${attachment.id}`} download />}
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
        <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Diskon</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
        <TableBody>{invoice.items.map((item) => <Fragment key={item.id}>
          <TableRow><TableCell>{item.productName ?? "Produk"}</TableCell><TableCell>{item.description || "-"}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.discountAmount)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.total)}</TableCell></TableRow>
          {item.addons.map((addon) => <TableRow key={`${item.id}-${addon.label}`}><TableCell className="pl-6 text-muted-foreground">+ {addon.label}</TableCell><TableCell className="text-muted-foreground">{addon.description?.trim() || "-"}</TableCell><TableCell className="text-right font-mono text-muted-foreground">{addon.qty}</TableCell><TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(addon.unitAmount)}</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell><TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(Number(addon.unitAmount.toString()) * addon.qty)}</TableCell></TableRow>)}
        </Fragment>)}</TableBody>
      </Table>
      <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(invoice.subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{formatCurrency(invoice.totalDiscount)}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-2 font-medium"><dt>Total</dt><dd className="font-mono">{formatCurrency(invoice.total)}</dd></div>
      </dl>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1">{INVOICE_STATUS_LABEL[invoice.status]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Diterbitkan</dt><dd className="mt-1">{formatDate(invoice.issuedAt, true)}</dd></div>
        {invoice.notes ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Catatan</dt><dd className="mt-1 whitespace-pre-wrap">{invoice.notes}</dd></div> : null}
      </dl>
    </div>
  );
}
