"use client";

import { CheckCircle2 } from "lucide-react";

import { agreePurchaseOrderAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type PurchaseOrderAgreementActionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  version: number;
  revisionLabel: string;
  canAgree: boolean;
  designMessage: string | null;
};

export function PurchaseOrderAgreementAction({
  opportunityId,
  purchaseOrderId,
  version,
  revisionLabel,
  canAgree,
  designMessage,
}: PurchaseOrderAgreementActionProps) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
    <form action={agreePurchaseOrderAction} className="contents">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="version" value={version} />
      <ConfirmSubmitButton
        className="w-full sm:w-auto"
        disabled={!canAgree || undefined}
        pendingLabel="Mengunci PO..."
        confirmTitle="Sepakati PO terbaru?"
        confirmDescription={`${revisionLabel} akan menjadi sumber resmi ukuran dan jumlah untuk invoice. Setelah disepakati, PO bersifat final dan tidak dapat direvisi.`}
        confirmLabel="Ya, sepakati PO"
      >
        <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
        Sepakati PO terbaru
      </ConfirmSubmitButton>
    </form>
    {designMessage ? <p className="max-w-xs text-xs text-muted-foreground">{designMessage}</p> : null}
    </div>
  );
}
