"use client";

import { CheckCircle2, Send } from "lucide-react";

import { agreePurchaseOrderAction, markPurchaseOrderDesignSentAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PurchaseOrderDepositAction, type PurchaseOrderDepositValues } from "@/components/crm/purchase-order-deposit-form";
import { formatDate } from "@/lib/crm/format";

export type PurchaseOrderDesignItem = {
  id: string;
  name: string;
  revisionCount: number;
};

type PurchaseOrderAgreementActionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  version: number;
  revisionLabel: string;
  canAgree: boolean;
  designMessage: string | null;
  designSentAt: Date | string | null;
  designSentByName: string | null;
  designItems: PurchaseOrderDesignItem[];
  depositRequired: boolean;
  deposit: PurchaseOrderDepositValues | null;
  depositMethods: Array<{ id: string; name: string }>;
  canEditDeposit: boolean;
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
  designItems,
  depositRequired,
  deposit,
  depositMethods,
  canEditDeposit,
}: PurchaseOrderAgreementActionProps) {
  // Alur: Checkbox Deposit -> Isi Deposit (bila dicentang) -> Desain diunggah dari Edit PO -> Kirim 1 set PDF -> Sepakati PO.
  const depositPaid = deposit !== null;
  // Tombol Isi Deposit hanya tampil untuk PO yang checkbox Deposit-nya dicentang.
  const showDepositAction = depositRequired || depositPaid;
  const designItemCount = designItems.length;
  const designUploadedCount = designItems.filter((item) => item.revisionCount > 0).length;
  const designUploaded = designItemCount > 0 && designUploadedCount === designItemCount;
  const canSendPdf = designUploaded;
  // Desain diubah dari form Edit PO (blok "Desain customer"), bukan dari dialog terpisah.
  const sendPdfBlockedReason = canSendPdf
    ? null
    : designItemCount > 1
      ? "Unggah desain semua produk lewat Edit PO sebelum mengirim 1 set PDF."
      : "Unggah desain lewat Edit PO sebelum mengirim 1 set PDF.";
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex w-full flex-row flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {showDepositAction ? (
        <PurchaseOrderDepositAction purchaseOrderId={purchaseOrderId} deposit={deposit} methods={depositMethods} canEdit={canEditDeposit} />
      ) : null}
      {/* PDF boleh dikirim berulang: tombol kirim selalu tampil selama PO masih draft. */}
      <form action={markPurchaseOrderDesignSentAction} className="contents">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
        <input type="hidden" name="version" value={version} />
        {/* Pengiriman otomatis menandai customer tidak ada revisi (audit), tanpa langkah konfirmasi terpisah. */}
        <input type="hidden" name="customerConfirmed" value="yes" />
        <ConfirmSubmitButton
          className="w-auto"
          variant="outline"
          disabled={!canSendPdf || undefined}
          title={sendPdfBlockedReason ?? "Kirim 1 set PDF ke customer"}
          pendingLabel="Menandai..."
          confirmTitle="Kirim 1 set PDF ke customer?"
          confirmDescription="Unduh PDF PO lalu kirim ke customer. Pengiriman otomatis menandai customer tidak ada revisi."
          confirmLabel="Ya, sudah dikirim"
        >
          <Send data-icon="inline-start" aria-hidden="true" />
          Kirim 1 set PDF
        </ConfirmSubmitButton>
      </form>
      <form action={agreePurchaseOrderAction} className="contents">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
        <input type="hidden" name="version" value={version} />
        <ConfirmSubmitButton
          className="w-auto"
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
      </div>
      {showDepositAction && !depositPaid ? <p className="max-w-xs text-xs text-muted-foreground sm:text-right">Menunggu deposit dibayar. Klik Isi Deposit.</p> : null}
      {depositPaid && !designUploaded && !designMessage ? <p className="max-w-xs text-xs text-muted-foreground sm:text-right">Unggah desain dulu sebelum mengirim 1 set PDF.</p> : null}
      {designSentAt ? <p className="max-w-xs text-xs text-muted-foreground">1 set PDF dikirim {formatDate(designSentAt, true)}{designSentByName ? ` oleh ${designSentByName}` : ""}.</p> : null}
      {designMessage ? <p className="max-w-xs text-xs text-muted-foreground">{designMessage}</p> : null}
    </div>
  );
}
