"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { CopyPlus, Eye, XCircle } from "lucide-react";

import { cancelInvoiceAction } from "@/app/actions/crm";
import { DocumentCancelButton } from "@/components/crm/document-cancel-button";
import { InvoiceForm } from "@/components/crm/invoice-form";
import { InvoiceDeliveryActions } from "@/components/crm/invoice-delivery-actions";
import { Button } from "@/components/ui/button";

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  sizes: Array<{ id: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  depositAmount?: string | null;
};

type InvoiceDraftValues = {
  notes: string;
  /** Jatuh tempo diisi manual pada form draft. */
  dueAt?: string;
  /** Prefill jadwal pembayaran tersimpan (opsional saat simpan, wajib sebelum terbit). */
  schedule?: {
    kind: string;
    initialValueType: "NOMINAL" | "PERCENTAGE";
    initialValue: string;
    initialDueAt: string;
    terms: Array<{ value: string; dueAt: string }>;
  };
  discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountPercent: string;
  discountNominal?: string;
  taxPercent?: string;
  addons?: Array<{ label?: string; description?: string; amount?: string; qty?: number }>;
  items: Array<{
    productName?: string;
    description?: string;
    size?: string;
    sleeveLength?: "PENDEK" | "PANJANG" | null;
    quantity?: number;
    unitPrice: string;
    discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
    discountPercent?: string;
    discountNominal?: string;
  }>;
};

type InvoiceWorkflowSectionProps = {
  opportunityId: string;
  invoiceId: string;
  invoiceVersion: number;
  invoiceStatus: "DRAFT" | "ISSUED" | "SUPERSEDED" | "CANCELLED";
  title: string;
  description: string;
  canOperate: boolean;
  canCancel: boolean;
  inNegotiation: boolean;
  purchaseOrder: PurchaseOrder | null;
  /** Sales Order aktif menutup revisi invoice karena pembayaran/produksi sudah berjalan. */
  hasSalesOrder: boolean;
  /** Revisi yang lebih baru sudah ada; invoice lama tidak boleh bercabang. */
  hasNewerActiveRevision: boolean;
  revisionLimitReached: boolean;
  draftValues: InvoiceDraftValues;
  salesOrderHref?: string;
  salesOrderLabel?: string;
  /** Tombol Lihat Kwitansi per pembayaran yang sudah dibayar (tab Invoice pada peluang). */
  receipts?: Array<{ id: string; label: string }>;
  children: ReactNode;
};

export function InvoiceWorkflowSection({
  opportunityId,
  invoiceId,
  invoiceVersion,
  invoiceStatus,
  title,
  description,
  canOperate,
  canCancel,
  inNegotiation,
  purchaseOrder,
  hasSalesOrder,
  hasNewerActiveRevision,
  revisionLimitReached,
  draftValues,
  salesOrderHref,
  salesOrderLabel,
  receipts,
  children,
}: InvoiceWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  // Draft dan invoice terbit tanpa Sales Order dapat direvisi. Invoice terbit lama tetap
  // aktif sampai revisinya diterbitkan, sehingga revisi baru tidak bercabang.
  const canReviseStatus = invoiceStatus === "DRAFT" || (invoiceStatus === "ISSUED" && !hasSalesOrder);
  const showCreateRevision = canReviseStatus && !hasNewerActiveRevision && !revisionLimitReached && canOperate && inNegotiation && !isCreatingRevision && Boolean(purchaseOrder);
  // Saat revisi masih draft, invoice terbit lama hanya boleh dilihat PDF-nya, bukan dikirim ulang.
  const showDeliveryActions = invoiceStatus === "ISSUED" && !hasNewerActiveRevision;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`invoice-${invoiceId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {!isCreatingRevision && showDeliveryActions ? <InvoiceDeliveryActions invoiceId={invoiceId} invoiceNo={title.split(" · ")[0]} receipts={receipts} /> : null}
          {!isCreatingRevision && !showDeliveryActions ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              render={<a href={`/api/crm/invoice/${invoiceId}/pdf?preview=1`} target="_blank" rel="noopener noreferrer" aria-label={`Lihat PDF ${title.split(" · ")[0]}`} />}
              nativeButton={false}
            >
              <Eye data-icon="inline-start" aria-hidden="true" />
              Lihat PDF
            </Button>
          ) : null}
          {showCreateRevision ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              Buat versi revisi
            </Button>
          ) : null}
          {canCancel && invoiceStatus === "DRAFT" ? (
            <DocumentCancelButton
              action={cancelInvoiceAction}
              fields={{ invoiceId, version: invoiceVersion }}
              title="Batalkan invoice draft?"
              description="Invoice akan berstatus Dibatalkan dan tidak dapat diterbitkan lagi. Perubahan hanya pada status dan audit log; data lain tidak diubah."
            />
          ) : null}
          {!isCreatingRevision && salesOrderHref && salesOrderLabel ? (
            <Button variant="outline" className="w-full sm:w-auto" render={<Link href={salesOrderHref} />} nativeButton={false}>
              {salesOrderLabel}
            </Button>
          ) : null}
        </div>
      </div>
      {isCreatingRevision && purchaseOrder ? (
        <>
          <InvoiceForm
            opportunityId={opportunityId}
            purchaseOrder={purchaseOrder}
            initialValues={draftValues}
            sourceInvoiceId={invoiceId}
            submitLabel="Buat versi revisi"
          />
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
            onClick={() => setIsCreatingRevision(false)}
          >
            <XCircle data-icon="inline-start" aria-hidden="true" />
            Batalkan draft revisi
          </Button>
        </>
      ) : (
        children
      )}
    </>
  );
}
