"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { CopyPlus, Save, XCircle } from "lucide-react";

import { cancelInvoiceAction } from "@/app/actions/crm";
import { DocumentCancelButton } from "@/components/crm/document-cancel-button";
import { DocumentPrintButton } from "@/components/crm/document-print-button";
import { InvoiceForm } from "@/components/crm/invoice-form";
import { InvoiceDeliveryActions } from "@/components/crm/invoice-delivery-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
  /** Alasan pembatalan dinonaktifkan (mis. DP/Lunas sudah masuk). */
  cancelBlockedReason?: string | null;
  inNegotiation: boolean;
  purchaseOrder: PurchaseOrder | null;
  /** Sales Order aktif menutup revisi invoice karena pembayaran/produksi sudah berjalan. */
  hasSalesOrder: boolean;
  /** Sales Order sudah dibatalkan: invoice batal-nya tidak bisa diganti selama PO-nya sama. */
  hasCancelledSalesOrder?: boolean;
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
  cancelBlockedReason = null,
  inNegotiation,
  purchaseOrder,
  hasSalesOrder,
  hasCancelledSalesOrder = false,
  hasNewerActiveRevision,
  revisionLimitReached,
  draftValues,
  salesOrderHref,
  salesOrderLabel,
  receipts,
  children,
}: InvoiceWorkflowSectionProps) {
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  // Tombol simpan berada di header (di luar <form>), jadi status siap-simpan dan proses
  // simpan dilaporkan oleh InvoiceForm agar tombol tidak aktif sebelum jadwal valid.
  const [isFormReady, setIsFormReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const revisionFormId = `invoice-revision-${invoiceId}`;
  const stopRevision = () => {
    setIsCreatingRevision(false);
    setIsSaving(false);
    setIsFormReady(false);
  };
  // Setelah revisi tersimpan, invoice sumber menjadi SUPERSEDED dan `version` bertambah;
  // parent memberi key `${id}-${version}` sehingga section ini remount dan kembali ke
  // kondisi awal tanpa perlu setState di dalam effect.
  // Draft dan invoice terbit tanpa Sales Order dapat direvisi. Invoice terbit lama tetap
  // aktif sampai revisinya diterbitkan, sehingga revisi baru tidak bercabang.
  // Invoice yang PO-nya sudah pernah menjadi Sales Order (walau dibatalkan) tidak bisa direvisi:
  // satu PO hanya boleh punya satu Sales Order, jadi revisinya tidak akan pernah bisa di-Deal-kan.
  const canReviseStatus =
    invoiceStatus === "CANCELLED"
      // Invoice batal boleh dilanjutkan selama PO-nya belum pernah menjadi Sales Order.
      ? !hasSalesOrder && !hasCancelledSalesOrder
      : invoiceStatus === "DRAFT" || (invoiceStatus === "ISSUED" && !hasSalesOrder && !hasCancelledSalesOrder);
  // Invoice disepakati/terbit boleh dibatalkan selama belum ada DP/Lunas masuk. SO aktif
  // tanpa pembayaran akan ikut dibatalkan server agar PO dapat direvisi.
  const canCancelInvoice = invoiceStatus === "DRAFT" || invoiceStatus === "ISSUED";
  // Dokumen batal dikecualikan dari batas 3 revisi agar peluang tidak menjadi jalan buntu.
  const revisionLimitBlocks = invoiceStatus !== "CANCELLED" && revisionLimitReached;
  const showCreateRevision = canReviseStatus && !hasNewerActiveRevision && !revisionLimitBlocks && canOperate && inNegotiation && !isCreatingRevision && Boolean(purchaseOrder);
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
          {isCreatingRevision ? (
            <>
              <Button
                type="submit"
                form={revisionFormId}
                className="w-full sm:w-auto"
                disabled={!isFormReady || isSaving}
              >
                {isSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" aria-hidden="true" />}
                {isSaving ? "Menyimpan..." : "Simpan perubahan"}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={stopRevision}>
                <XCircle data-icon="inline-start" aria-hidden="true" />
                Batalkan perubahan
              </Button>
            </>
          ) : (
            <>
              <DocumentPrintButton href={`/api/crm/invoice/${invoiceId}/pdf`} label={`Print ${title.split(" · ")[0]}`} />
              {showDeliveryActions ? <InvoiceDeliveryActions invoiceId={invoiceId} invoiceNo={title.split(" · ")[0]} receipts={receipts} /> : null}
              {showCreateRevision ? (
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCreatingRevision(true)}>
                  <CopyPlus data-icon="inline-start" aria-hidden="true" />
                  Buat revisi invoice
                </Button>
              ) : null}
              {canCancel && canCancelInvoice ? (
                cancelBlockedReason ? (
                  <p className="max-w-xs text-xs text-muted-foreground sm:text-right">{cancelBlockedReason}</p>
                ) : (
                  <DocumentCancelButton
                    action={cancelInvoiceAction}
                    fields={{ invoiceId, version: invoiceVersion }}
                    triggerLabel={invoiceStatus === "ISSUED" ? "Batalkan invoice terbit" : "Batalkan invoice"}
                    confirmLabel="Ya, batalkan invoice"
                    title={invoiceStatus === "ISSUED" ? "Batalkan invoice terbit?" : "Batalkan invoice draft?"}
                    description={
                      invoiceStatus === "ISSUED"
                        ? hasSalesOrder
                          ? "Belum ada pembayaran DP/Lunas pada Sales Order, jadi invoice masih dapat dibatalkan. Sales Order dan Work Order ikut dibatalkan, peluang kembali ke Negosiasi, dan PO dapat direvisi."
                          : "Invoice terbit ini belum memiliki Sales Order, jadi masih dapat dibatalkan. Nomor invoice menjadi tidak berlaku, jadwal pembayarannya dilepas, dan PO dapat direvisi setelahnya. Invoice tidak dapat diterbitkan ulang."
                        : "Invoice akan berstatus Dibatalkan dan tidak dapat diterbitkan lagi. Perubahan hanya pada status dan audit log; data lain tidak diubah."
                    }
                  />
                )
              ) : null}
              {salesOrderHref && salesOrderLabel ? (
                <Button variant="outline" className="w-full sm:w-auto" render={<Link href={salesOrderHref} />} nativeButton={false}>
                  {salesOrderLabel}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {isCreatingRevision && purchaseOrder ? (
        <InvoiceForm
          opportunityId={opportunityId}
          purchaseOrder={purchaseOrder}
          initialValues={draftValues}
          sourceInvoiceId={invoiceId}
          formId={revisionFormId}
          hideSubmit
          onReadyChange={setIsFormReady}
          onPendingChange={setIsSaving}
        />
      ) : (
        children
      )}
    </>
  );
}
