"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CopyPlus, XCircle } from "lucide-react";

import { cancelPurchaseOrderAction } from "@/app/actions/crm";
import { DocumentCancelButton } from "@/components/crm/document-cancel-button";
import { PurchaseOrderForm, type ProductCategoryOption } from "@/components/crm/purchase-order-form";
import { PurchaseOrderPdfDownloadButton } from "@/components/crm/purchase-order-pdf-download-button";
import { Button } from "@/components/ui/button";

type SizeOption = { id: string; name: string };
type PurchaseOrderDraftValues = {
  purchaseOrderNo: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  productCategoryId: string | null;
  productName: string;
  material: string;
  baseColor: string;
  variationColor: string;
  decorationMethod: string;
  orderDate: string;
  sampleSize: string;
  designNotes: string;
  notes: string;
  deadline: string;
  designDeadline: string;
  sizes: Array<{ sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  roster: Array<{ memberId: string; name: string; sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG" }>;
};

type PurchaseOrderWorkflowSectionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  purchaseOrderVersion: number;
  purchaseOrderRevision: number;
  purchaseOrderStatus: "DRAFT" | "AGREED" | "SUPERSEDED" | "CANCELLED";
  title: string;
  description: string;
  canOperate: boolean;
  canCancel: boolean;
  inNegotiation: boolean;
  sizeOptions: SizeOption[];
  categoryOptions: ProductCategoryOption[];
  draftValues: PurchaseOrderDraftValues;
  purchaseOrderNoPreview: string;
  children: ReactNode;
};

export function PurchaseOrderWorkflowSection({
  opportunityId,
  purchaseOrderId,
  purchaseOrderVersion,
  purchaseOrderRevision,
  purchaseOrderStatus,
  title,
  description,
  canOperate,
  canCancel,
  inNegotiation,
  sizeOptions,
  categoryOptions,
  draftValues,
  purchaseOrderNoPreview,
  children,
}: PurchaseOrderWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const isEditingPersistedDraft = purchaseOrderStatus === "DRAFT" && purchaseOrderRevision < 4 && canOperate && inNegotiation && !isCreatingRevision;
  const isEditing = isEditingPersistedDraft || isCreatingRevision;
  const canCreateRevision = purchaseOrderStatus === "DRAFT" && purchaseOrderRevision < 4 && canOperate && inNegotiation && !isCreatingRevision;
  const persistedDraft = isEditingPersistedDraft
      ? {
        ...draftValues,
        id: purchaseOrderId,
        version: purchaseOrderVersion,
        purchaseOrderNo: draftValues.purchaseOrderNo,
      }
    : undefined;

  return (
    <>
      <div className="mb-4 flex min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`po-${purchaseOrderId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {!isEditing ? (
            <PurchaseOrderPdfDownloadButton purchaseOrderId={purchaseOrderId} purchaseOrderNo={draftValues.purchaseOrderNo} />
          ) : null}
          {canCreateRevision ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              Buat versi revisi
            </Button>
          ) : null}
          {canCancel && purchaseOrderStatus === "DRAFT" ? (
            <DocumentCancelButton
              action={cancelPurchaseOrderAction}
              fields={{ purchaseOrderId, version: purchaseOrderVersion }}
              title="Batalkan PO draft?"
              description="PO akan berstatus Dibatalkan dan tidak dapat disepakati lagi. Perubahan hanya pada status dan audit log; data lain tidak diubah."
            />
          ) : null}
        </div>
      </div>
      {isEditing ? (
        <div className="min-w-0 max-w-full">
          <PurchaseOrderForm
            opportunityId={opportunityId}
            sizeOptions={sizeOptions}
            categoryOptions={categoryOptions}
            draft={persistedDraft}
            initialValues={isCreatingRevision ? draftValues : undefined}
            sourcePurchaseOrderId={isCreatingRevision ? purchaseOrderId : undefined}
            submitLabel={isCreatingRevision ? "Buat versi revisi" : "Perbarui draft PO"}
            purchaseOrderNoPreview={purchaseOrderNoPreview}
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
        </div>
      ) : (
        children
      )}
    </>
  );
}
