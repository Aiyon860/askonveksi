"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CopyPlus } from "lucide-react";

import { cancelPurchaseOrderAction } from "@/app/actions/crm";
import { DocumentCancelButton } from "@/components/crm/document-cancel-button";
import type { PenjahitPlanItem } from "@/components/crm/penjahit-plan-dialog";
import { PurchaseOrderForm, type ProductCategoryOption } from "@/components/crm/purchase-order-form";
import { PurchaseOrderPdfDownloadButton } from "@/components/crm/purchase-order-pdf-download-button";
import { Button } from "@/components/ui/button";

type SizeOption = { id: string; name: string };
export type PurchaseOrderItemDraftValues = {
  key: string;
  name: string;
  pola: string;
  /** Revisi: bahan per produk. */
  material: string;
  /** Revisi: warna per produk (wajib dasar, variasi opsional). */
  baseColor: string;
  variationColor: string;
  productCategoryId: string;
  decorationMethods: string[];
  designNotes: string;
  /** Gambar desain customer terakhir, ditampilkan saat Edit PO disepakati. */
  designs?: Array<{ id: string; name: string }>;
  matrix: Record<string, number>;
  rosterMode: "none" | "manual" | "excel";
  roster: Array<{ key: string; memberId: string; name: string; jabatan: string; sizeId: string; sleeveLength: "PENDEK" | "PANJANG" | "" }>;
  accessoryQuantity: string;
};
type PurchaseOrderDraftValues = {
  purchaseOrderNo: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  productCategoryId: string | null;
  instansi: string;
  material: string;
  baseColor: string;
  variationColor: string;
  orderDate: string;
  sampleSize: string;
  designNotes: string;
  notes: string;
  deadline: string;
  designDeadline: string;
  depositRequired: boolean;
  items: PurchaseOrderItemDraftValues[];
};

type PurchaseOrderWorkflowSectionProps = {
  opportunityId: string;
  purchaseOrderId: string;
  purchaseOrderVersion: number;
  purchaseOrderStatus: "DRAFT" | "AGREED" | "SUPERSEDED" | "CANCELLED";
  title: string;
  description: string;
  canOperate: boolean;
  canCancel: boolean;
  /** Alasan pembatalan dinonaktifkan (mis. masih ada invoice aktif atau DP/Lunas sudah masuk). */
  cancelBlockedReason?: string | null;
  inNegotiation: boolean;
  sizeOptions: SizeOption[];
  categoryOptions: ProductCategoryOption[];
  draftValues: PurchaseOrderDraftValues;
  purchaseOrderNoPreview: string;
  defaultInstansi?: string;
  /** Role yang boleh membuka Data Master ukuran; dipakai tautan "Tambah ukuran" di form revisi. */
  canManageSizes?: boolean;
  /** Hanya dokumen terakhir pada rantai PO yang boleh dilanjutkan dari status batal. */
  latestInChain?: boolean;
  /** Sprint 11 (R3): baris deadline/desain penjahit per item untuk dialog Edit PDF Penjahit. */
  penjahitItems: PenjahitPlanItem[];
  /** Masih ada invoice DRAFT/ISSUED pada PO ini: qty & ukuran dikunci saat edit. */
  invoiceActive?: boolean;
  /** Tugas desain PO, dipakai pratinjau gambar desain customer di form edit. */
  designTaskId?: string | null;
  children: ReactNode;
};

export function PurchaseOrderWorkflowSection({
  opportunityId,
  purchaseOrderId,
  purchaseOrderVersion,
  purchaseOrderStatus,
  title,
  description,
  canOperate,
  canCancel,
  cancelBlockedReason = null,
  inNegotiation,
  sizeOptions,
  categoryOptions,
  draftValues,
  purchaseOrderNoPreview,
  defaultInstansi,
  canManageSizes = false,
  latestInChain = true,
  penjahitItems,
  invoiceActive = false,
  designTaskId = null,
  children,
}: PurchaseOrderWorkflowSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Satu form edit untuk semua status aktif, sama seperti Revisi PO.
  // - Ada invoice aktif: simpan langsung ke PO yang sama, qty/ukuran dikunci.
  // - Tanpa invoice aktif: simpan sebagai versi revisi baru (perilaku Revisi PO).
  // - PO batal: form yang sama membuat dokumen PO baru (hanya dokumen terakhir).
  const canEditPurchaseOrder = canOperate && inNegotiation && (purchaseOrderStatus === "DRAFT" || purchaseOrderStatus === "AGREED");
  const canCreateSuccessor = canOperate && inNegotiation && purchaseOrderStatus === "CANCELLED" && latestInChain;
  const canOpenEditForm = !isEditing && (canEditPurchaseOrder || canCreateSuccessor);
  const inPlaceEdit = invoiceActive && purchaseOrderStatus === "AGREED";
  // PO disepakati boleh dibatalkan sebelum ada invoice aktif dan sebelum DP/Lunas masuk.
  // Setelah batal, tombol "Buat PO baru" di atas menjadi jalur revisi dokumen.
  const canCancelPurchaseOrder = purchaseOrderStatus === "DRAFT" || purchaseOrderStatus === "AGREED";

  return (
    <>
      <div className="mb-4 flex min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 id={`po-${purchaseOrderId}`} className="font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {canOpenEditForm ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setIsEditing(true)}>
              <CopyPlus data-icon="inline-start" aria-hidden="true" />
              {purchaseOrderStatus === "CANCELLED" ? "Buat PO baru" : "Edit PO"}
            </Button>
          ) : null}
          {!isEditing ? (
            <PurchaseOrderPdfDownloadButton
              purchaseOrderId={purchaseOrderId}
              purchaseOrderNo={draftValues.purchaseOrderNo}
              penjahit={{
                version: purchaseOrderVersion,
                canEdit: (purchaseOrderStatus === "DRAFT" || purchaseOrderStatus === "AGREED") && canOperate,
                items: penjahitItems,
              }}
            />
          ) : null}
          {canCancel && canCancelPurchaseOrder && !isEditing ? (
            cancelBlockedReason ? (
              <p className="max-w-xs text-xs text-muted-foreground sm:text-right">{cancelBlockedReason}</p>
            ) : (
              <DocumentCancelButton
                action={cancelPurchaseOrderAction}
                fields={{ purchaseOrderId, version: purchaseOrderVersion }}
                triggerLabel={purchaseOrderStatus === "AGREED" ? "Batalkan PO disepakati" : "Batalkan PO"}
                title={purchaseOrderStatus === "AGREED" ? "Batalkan PO disepakati?" : "Batalkan PO draft?"}
                description={
                  purchaseOrderStatus === "AGREED"
                    ? "PO disepakati dapat dibatalkan selama belum ada pembayaran DP/Lunas dan tidak ada invoice aktif. Setelah dibatalkan, PO dapat dilanjutkan sebagai dokumen baru."
                    : "PO akan berstatus Dibatalkan dan tidak dapat disepakati lagi. Perubahan hanya pada status dan audit log; data lain tidak diubah."
                }
              />
            )
          ) : null}
        </div>
      </div>
      {isEditing ? (
        <div className="min-w-0 max-w-full">
          <PurchaseOrderForm
            opportunityId={opportunityId}
            sizeOptions={sizeOptions}
            categoryOptions={categoryOptions}
            initialValues={draftValues}
            sourcePurchaseOrderId={purchaseOrderId}
            purchaseOrderVersion={purchaseOrderVersion}
            inPlaceEdit={inPlaceEdit}
            // Satu pintu ubah desain: selalu lewat form Edit PO, baik draft maupun sudah disepakati.
            customerDesignsEditable={purchaseOrderStatus === "DRAFT" || purchaseOrderStatus === "AGREED"}
            customerDesignTaskId={designTaskId}
            onCancelEdit={() => setIsEditing(false)}
            lockInvoiceQuantities={inPlaceEdit}
            submitLabel={
              inPlaceEdit
                ? "Simpan perubahan PO"
                : purchaseOrderStatus === "CANCELLED"
                  ? "Buat PO baru"
                  : "Simpan revisi PO"
            }
            purchaseOrderNoPreview={purchaseOrderNoPreview}
            defaultInstansi={defaultInstansi}
            canManageSizes={canManageSizes}
          />
        </div>
      ) : (
        children
      )}
    </>
  );
}
