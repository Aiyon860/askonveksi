"use client";

import { CheckCircle2, Send } from "lucide-react";

import { agreePurchaseOrderAction, confirmPurchaseOrderCustomerAction, markPurchaseOrderDesignSentAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatDate } from "@/lib/crm/format";

type PurchaseOrderAgreementActionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  version: number;
  revisionLabel: string;
  canAgree: boolean;
  designMessage: string | null;
  designSentAt: Date | string | null;
  designSentByName: string | null;
  customerConfirmedAt: Date | string | null;
};

export function PurchaseOrderAgreementAction({
  opportunityId,
  purchaseOrderId,
  version,
  revisionLabel,
  canAgree,
  designMessage,
  designSentAt,
  designSentByName,
  customerConfirmedAt,
}: PurchaseOrderAgreementActionProps) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {!designSentAt ? (
        <form action={markPurchaseOrderDesignSentAction} className="contents">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
          <input type="hidden" name="version" value={version} />
          <ConfirmSubmitButton
            className="w-full sm:w-auto"
            variant="outline"
            pendingLabel="Menandai..."
            confirmTitle="Kirim 1 set PDF ke customer?"
            confirmDescription="Unduh PDF PO lalu kirim ke customer. Penanda ini mencatat siapa dan kapan mengirim."
            confirmLabel="Ya, sudah dikirim"
          >
            <Send data-icon="inline-start" aria-hidden="true" />
            Kirim 1 set PDF
          </ConfirmSubmitButton>
        </form>
      ) : !customerConfirmedAt ? (
        <form action={confirmPurchaseOrderCustomerAction} className="contents">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
          <input type="hidden" name="version" value={version} />
          <ConfirmSubmitButton
            className="w-full sm:w-auto"
            variant="outline"
            pendingLabel="Mencatat..."
            confirmTitle="Customer tidak ada revisi?"
            confirmDescription="Pastikan customer sudah melihat PDF dan menyatakan tidak ada revisi."
            confirmLabel="Ya, tidak ada revisi"
          >
            <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
            Konfirmasi customer
          </ConfirmSubmitButton>
        </form>
      ) : null}
      <form action={agreePurchaseOrderAction} className="contents">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
        <input type="hidden" name="version" value={version} />
        <ConfirmSubmitButton
          className="w-full sm:w-auto"
          disabled={!canAgree || undefined}
          pendingLabel="Mengunci PO..."
          confirmTitle="Sepakati PO terbaru?"
          confirmDescription={`${revisionLabel} akan menjadi sumber resmi ukuran dan jumlah untuk invoice. Setelah disepakati, perubahan hanya lewat revisi PO.`}
          confirmLabel="Ya, sepakati PO"
        >
          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
          Sepakati PO terbaru
        </ConfirmSubmitButton>
      </form>
      {designSentAt ? <p className="max-w-xs text-xs text-muted-foreground">1 set PDF dikirim {formatDate(designSentAt, true)}{designSentByName ? ` oleh ${designSentByName}` : ""}.</p> : null}
      {customerConfirmedAt ? <p className="max-w-xs text-xs text-muted-foreground">Customer konfirmasi tidak ada revisi {formatDate(customerConfirmedAt, true)}.</p> : null}
      {designMessage ? <p className="max-w-xs text-xs text-muted-foreground">{designMessage}</p> : null}
    </div>
  );
}
