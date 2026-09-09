"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { CopyPlus, FileDown, XCircle } from "lucide-react";

import { cancelPurchaseOrderDraftAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PurchaseOrderForm } from "@/components/crm/purchase-order-form";
import { Button } from "@/components/ui/button";

type SizeOption = { id: string; name: string };
type PurchaseOrderDraftValues = {
  customerReference: string;
  garmentType: "JERSEY" | "NON_JERSEY" | null;
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
  attachmentCount: number;
  sizes: Array<{ sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  roster: Array<{ memberId: string; name: string; sizeId: string | null; size: string }>;
};

type PurchaseOrderWorkflowSectionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  purchaseOrderVersion: number;
  purchaseOrderRevision: number;
  purchaseOrderStatus: "DRAFT" | "AGREED" | "SUPERSEDED";
  title: string;
  description: string;
  canOperate: boolean;
  inNegotiation: boolean;
  hasActiveDraft: boolean;
  sizeOptions: SizeOption[];
  draftValues: PurchaseOrderDraftValues;
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
  inNegotiation,
  hasActiveDraft,
  sizeOptions,
  draftValues,
  children,
}: PurchaseOrderWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const isEditingPersistedDraft = purchaseOrderStatus === "DRAFT" && canOperate && inNegotiation;
  const isEditing = isEditingPersistedDraft || isCreatingRevision;
  const canCreateRevision = purchaseOrderStatus === "AGREED" && canOperate && inNegotiation && !hasActiveDraft && !isCreatingRevision;
  const persistedDraft = isEditingPersistedDraft
    ? {
        id: purchaseOrderId,
        version: purchaseOrderVersion,
        ...draftValues,
      }
    : undefined;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`po-${purchaseOrderId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {!isEditing ? (
            <Button className="w-full sm:w-auto" render={<Link href={`/api/crm/purchase-order/${purchaseOrderId}/pdf`} />} nativeButton={false}>
              <FileDown data-icon="inline-start" aria-hidden="true" />
              Unduh PDF PO
            </Button>
          ) : null}
          {canCreateRevision ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              Buat revisi PO
            </Button>
          ) : null}
        </div>
      </div>
      {isEditing ? (
        <>
          <PurchaseOrderForm
            opportunityId={opportunityId}
            sizeOptions={sizeOptions}
            draft={persistedDraft}
            initialValues={isCreatingRevision ? draftValues : undefined}
            sourcePurchaseOrderId={isCreatingRevision ? purchaseOrderId : undefined}
            submitLabel="Perbarui draft PO"
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
          ) : purchaseOrderRevision > 1 ? (
            <form action={cancelPurchaseOrderDraftAction} className="mt-2">
              <input type="hidden" name="opportunityId" value={opportunityId} />
              <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
              <input type="hidden" name="version" value={purchaseOrderVersion} />
              <ConfirmSubmitButton
                variant="outline"
                className="w-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                confirmButtonClassName="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20"
                pendingLabel="Membatalkan..."
                confirmTitle="Batalkan draft revisi PO?"
                confirmDescription="Draft revisi ini akan dihapus. PO yang sudah disepakati sebelumnya tetap menjadi dokumen aktif."
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
