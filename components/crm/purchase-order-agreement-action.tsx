"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { agreePurchaseOrderAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type PurchaseOrderAgreementActionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  version: number;
  revisionLabel: string;
  canAgree: boolean;
};

export function PurchaseOrderAgreementAction({
  opportunityId,
  purchaseOrderId,
  version,
  revisionLabel,
  canAgree,
}: PurchaseOrderAgreementActionProps) {
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const disabled = !canAgree || isDraftDirty;

  useEffect(() => {
    const draftForm = [...document.querySelectorAll<HTMLFormElement>("form[data-po-draft-id]")]
      .find((form) => form.dataset.poDraftId === purchaseOrderId);
    if (!draftForm) return;

    const markDirty = () => setIsDraftDirty(true);
    draftForm.addEventListener("input", markDirty, true);
    draftForm.addEventListener("change", markDirty, true);

    return () => {
      draftForm.removeEventListener("input", markDirty, true);
      draftForm.removeEventListener("change", markDirty, true);
    };
  }, [purchaseOrderId]);

  return (
    <form action={agreePurchaseOrderAction} className="contents">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="version" value={version} />
      <ConfirmSubmitButton
        className="w-full sm:w-auto"
        disabled={disabled || undefined}
        pendingLabel="Mengunci PO..."
        confirmTitle="Sepakati draft PO terbaru?"
        confirmDescription={`${revisionLabel} akan menjadi sumber resmi ukuran dan jumlah untuk invoice. Perubahan berikutnya dibuat sebagai revisi baru.`}
        confirmLabel="Ya, sepakati PO"
      >
        <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
        {isDraftDirty ? "Simpan draft dulu" : "Sepakati PO terbaru"}
      </ConfirmSubmitButton>
    </form>
  );
}
