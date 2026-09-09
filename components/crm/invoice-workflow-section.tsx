"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { CopyPlus, FileDown, XCircle } from "lucide-react";

import { cancelInvoiceDraftAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvoiceForm } from "@/components/crm/invoice-form";
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
  hasActiveDraft: boolean;
  canCreateRevision: boolean;
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
  hasActiveDraft,
  canCreateRevision,
  purchaseOrder,
  draftValues,
  salesOrderHref,
  salesOrderLabel,
  children,
}: InvoiceWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const isEditingPersistedDraft = invoiceStatus === "DRAFT" && canOperate && inNegotiation && Boolean(purchaseOrder);
  const isEditing = isEditingPersistedDraft || isCreatingRevision;
  const showCreateRevision = canCreateRevision && !hasActiveDraft && !isCreatingRevision && Boolean(purchaseOrder);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`invoice-${invoiceId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {!isEditing ? (
            <Button className="w-full sm:w-auto" render={<Link href={`/api/crm/invoice/${invoiceId}/pdf`} />} nativeButton={false}>
              <FileDown data-icon="inline-start" aria-hidden="true" />
              Unduh PDF
            </Button>
          ) : null}
          {showCreateRevision ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              Buat revisi invoice
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
            submitLabel="Perbarui draft invoice"
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
          ) : invoiceRevision > 1 ? (
            <form action={cancelInvoiceDraftAction} className="mt-2">
              <input type="hidden" name="opportunityId" value={opportunityId} />
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <input type="hidden" name="version" value={invoiceVersion} />
              <ConfirmSubmitButton
                variant="outline"
                className="w-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                confirmButtonClassName="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20"
                pendingLabel="Membatalkan..."
                confirmTitle="Batalkan draft revisi invoice?"
                confirmDescription="Draft revisi ini akan dihapus. Invoice terbit sebelumnya tetap menjadi dokumen aktif."
                confirmLabel="Ya, batalkan draft"
              >
                <XCircle data-icon="inline-start" aria-hidden="true" />
                Batalkan draft revisi
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </>
      ) : (
        children
      )}
    </>
  );
}
