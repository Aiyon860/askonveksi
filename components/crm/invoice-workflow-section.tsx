"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { CopyPlus, FileDown, XCircle } from "lucide-react";

import { InvoiceForm } from "@/components/crm/invoice-form";
import { InvoiceDeliveryActions } from "@/components/crm/invoice-delivery-actions";
import { Button } from "@/components/ui/button";

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  sizes: Array<{ id: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
};

type InvoiceDraftValues = {
  notes: string;
  taxRate: string;
  items: Array<{
    size: string;
    sleeveLength: "PENDEK" | "PANJANG" | null;
    quantity: number;
    unitPrice: string;
    discountPercent: string;
  }>;
};

type InvoiceWorkflowSectionProps = {
  opportunityId: string;
  invoiceId: string;
  invoiceVersion: number;
  invoiceRevision: number;
  invoiceStatus: "DRAFT" | "ISSUED" | "SUPERSEDED";
  title: string;
  description: string;
  canOperate: boolean;
  inNegotiation: boolean;
  purchaseOrder: PurchaseOrder | null;
  draftValues: InvoiceDraftValues;
  salesOrderHref?: string;
  salesOrderLabel?: string;
  children: ReactNode;
};

export function InvoiceWorkflowSection({
  opportunityId,
  invoiceId,
  invoiceVersion,
  invoiceRevision,
  invoiceStatus,
  title,
  description,
  canOperate,
  inNegotiation,
  purchaseOrder,
  draftValues,
  salesOrderHref,
  salesOrderLabel,
  children,
}: InvoiceWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const isEditingPersistedDraft = invoiceStatus === "DRAFT" && invoiceRevision < 4 && canOperate && inNegotiation && Boolean(purchaseOrder) && !isCreatingRevision;
  const isEditing = isEditingPersistedDraft || isCreatingRevision;
  const showCreateRevision = invoiceStatus === "DRAFT" && invoiceRevision < 4 && canOperate && inNegotiation && !isCreatingRevision && Boolean(purchaseOrder);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`invoice-${invoiceId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {!isEditing && invoiceStatus === "ISSUED" ? <InvoiceDeliveryActions invoiceId={invoiceId} invoiceNo={title.split(" · ")[0]} /> : null}
          {!isEditing && invoiceStatus !== "ISSUED" ? (
            <Button className="w-full sm:w-auto" render={<Link href={`/api/crm/invoice/${invoiceId}/pdf`} />} nativeButton={false}>
              <FileDown data-icon="inline-start" aria-hidden="true" />
              Unduh PDF
            </Button>
          ) : null}
          {showCreateRevision ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              Buat versi revisi
            </Button>
          ) : null}
          {!isEditing && salesOrderHref && salesOrderLabel ? (
            <Button variant="outline" className="w-full sm:w-auto" render={<Link href={salesOrderHref} />} nativeButton={false}>
              {salesOrderLabel}
            </Button>
          ) : null}
        </div>
      </div>
      {isEditing && purchaseOrder ? (
        <>
          <InvoiceForm
            opportunityId={opportunityId}
            purchaseOrder={purchaseOrder}
            draft={isEditingPersistedDraft ? { id: invoiceId, version: invoiceVersion, ...draftValues } : undefined}
            initialValues={isCreatingRevision ? draftValues : undefined}
            sourceInvoiceId={isCreatingRevision ? invoiceId : undefined}
            submitLabel={isCreatingRevision ? "Buat versi revisi" : "Perbarui draft invoice"}
          />
          {isCreatingRevision ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
              onClick={() => setIsCreatingRevision(false)}
            >
              <XCircle data-icon="inline-start" aria-hidden="true" />
              Batalkan draft revisi
            </Button>
          ) : null}
        </>
      ) : (
        children
      )}
    </>
  );
}
