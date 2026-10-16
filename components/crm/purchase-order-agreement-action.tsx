"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Send } from "lucide-react";

import { agreePurchaseOrderAction, confirmPurchaseOrderCustomerAction, markPurchaseOrderDesignSentAction } from "@/app/actions/crm";
import { uploadDesignRevisionAction } from "@/app/actions/design";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PurchaseOrderDepositAction, type PurchaseOrderDepositValues } from "@/components/crm/purchase-order-deposit-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { DESIGN_REVISION_LIMIT } from "@/lib/crm/constants";
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
  customerConfirmedAt: Date | string | null;
  designTaskId: string | null;
  designItems: PurchaseOrderDesignItem[];
  depositRequired: boolean;
  deposit: PurchaseOrderDepositValues | null;
  depositMethods: Array<{ id: string; name: string }>;
  canEditDeposit: boolean;
  canUploadDesign: boolean;
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
  designTaskId,
  designItems,
  depositRequired,
  deposit,
  depositMethods,
  canEditDeposit,
  canUploadDesign,
}: PurchaseOrderAgreementActionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  // Alur: Checkbox Deposit -> Isi Deposit (bila dicentang) -> Upload Desain per produk -> Kirim 1 set PDF -> Sepakati PO.
  const depositPaid = deposit !== null;
  // Tombol Isi Deposit hanya tampil untuk PO yang checkbox Deposit-nya dicentang.
  const showDepositAction = depositRequired || depositPaid;
  // Upload Desain menunggu deposit hanya bila PO ini memang memerlukan deposit.
  const depositSettled = !depositRequired || depositPaid;
  const designItemCount = designItems.length;
  const designUploadedCount = designItems.filter((item) => item.revisionCount > 0).length;
  const designUploaded = designItemCount > 0 && designUploadedCount === designItemCount;
  const canSendPdf = designUploaded;
  const everyItemAtLimit = designItemCount > 0 && designItems.every((item) => item.revisionCount >= DESIGN_REVISION_LIMIT);
  const canCreateRevision = canUploadDesign && designTaskId !== null && !everyItemAtLimit && depositSettled;
  const uploadBlockedReason = !canUploadDesign
    ? "Hanya Admin Customer atau Admin PO yang dapat mengunggah."
    : !depositSettled
      ? "Menunggu deposit dibayar. Klik Isi Deposit."
      : everyItemAtLimit
        ? `Batas ${DESIGN_REVISION_LIMIT} versi desain tercapai.`
        : null;
  const sendPdfBlockedReason = canSendPdf ? null : designItemCount > 1 ? "Unggah desain semua produk dulu sebelum mengirim 1 set PDF." : "Unggah desain dulu sebelum mengirim 1 set PDF.";
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex w-full flex-row flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {showDepositAction ? (
        <PurchaseOrderDepositAction purchaseOrderId={purchaseOrderId} deposit={deposit} methods={depositMethods} canEdit={canEditDeposit} />
      ) : null}
      {designTaskId ? (
        <>
          <Button size="sm" className="w-auto" disabled={!canCreateRevision || undefined} onClick={() => setUploadOpen(true)} title={uploadBlockedReason ?? "Unggah desain"}>
            <FileUp data-icon="inline-start" aria-hidden="true" />
            Upload Desain
          </Button>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Unggah desain</DialogTitle>
                <DialogDescription>
                  {designItemCount > 1
                    ? "Isi desain untuk produk yang sudah siap. File baru setiap produk disimpan sebagai versi terpisah dan langsung menjadi acuan produksi."
                    : "File baru selalu disimpan sebagai versi terpisah dan langsung menjadi acuan produksi."}
                </DialogDescription>
              </DialogHeader>
              <form action={uploadDesignRevisionAction} onSubmit={() => setUploadOpen(false)}>
                <input type="hidden" name="designTaskId" value={designTaskId} />
                <FieldGroup>
                  {designItems.map((item) => {
                    const atLimit = item.revisionCount >= DESIGN_REVISION_LIMIT;
                    const filesId = `po-design-files-${designTaskId}-${item.id}`;
                    const notesId = `po-design-notes-${designTaskId}-${item.id}`;
                    return (
                      <FieldSet key={item.id} className="rounded-lg border p-4">
                        <FieldLegend>{designItemCount > 1 ? item.name : "Desain"}</FieldLegend>
                        <Field>
                          <FieldLabel htmlFor={filesId} required={designItemCount === 1}>File desain</FieldLabel>
                          <FilePicker
                            id={filesId}
                            name={`designFiles-${item.id}`}
                            required={designItemCount === 1}
                            multiple
                            disabled={atLimit || undefined}
                            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          />
                          <FieldDescription>
                            {atLimit
                              ? `Batas ${DESIGN_REVISION_LIMIT} versi desain produk ini tercapai.`
                              : `PNG atau JPG, maksimal 5 file dan 5 MB per file. Versi tersimpan ${item.revisionCount}/${DESIGN_REVISION_LIMIT}.`}
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={notesId}>Catatan revisi</FieldLabel>
                          <Textarea id={notesId} name={`notes-${item.id}`} maxLength={4000} rows={3} placeholder="Contoh: Perubahan warna logo depan." />
                        </Field>
                      </FieldSet>
                    );
                  })}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Batal</Button>
                    <Button type="submit">Unggah desain</Button>
                  </DialogFooter>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {/* PDF boleh dikirim berulang: tombol kirim selalu tampil selama PO masih draft. */}
      <form action={markPurchaseOrderDesignSentAction} className="contents">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
        <input type="hidden" name="version" value={version} />
        <label className="flex w-auto cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs">
          <input type="checkbox" name="customerConfirmed" value="yes" required className="h-3.5 w-3.5" />
          Customer tidak ada revisi
        </label>
        <ConfirmSubmitButton
          className="w-auto"
          variant="outline"
          disabled={!canSendPdf || undefined}
          title={sendPdfBlockedReason ?? "Kirim 1 set PDF ke customer"}
          pendingLabel="Menandai..."
          confirmTitle="Kirim 1 set PDF ke customer?"
          confirmDescription="Unduh PDF PO lalu kirim ke customer. Centang berarti customer menyatakan tidak ada revisi."
          confirmLabel="Ya, sudah dikirim"
        >
          <Send data-icon="inline-start" aria-hidden="true" />
          Kirim 1 set PDF
        </ConfirmSubmitButton>
      </form>
      {designSentAt && !customerConfirmedAt ? (
        <form action={confirmPurchaseOrderCustomerAction} className="contents">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
          <input type="hidden" name="version" value={version} />
          <ConfirmSubmitButton
            className="w-auto"
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
      {customerConfirmedAt ? <p className="max-w-xs text-xs text-muted-foreground">Customer konfirmasi tidak ada revisi {formatDate(customerConfirmedAt, true)}.</p> : null}
      {designMessage ? <p className="max-w-xs text-xs text-muted-foreground">{designMessage}</p> : null}
    </div>
  );
}
