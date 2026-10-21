"use client";

import { Eye } from "lucide-react";

import { PenjahitPlanDialog, type PenjahitPlanItem } from "@/components/crm/penjahit-plan-dialog";
import { Button } from "@/components/ui/button";

export function PurchaseOrderPdfDownloadButton({
  purchaseOrderId,
  purchaseOrderNo,
  penjahit,
}: {
  purchaseOrderId: string;
  purchaseOrderNo: string;
  /** Sprint 11 (R3): tombol Edit PDF Penjahit menempel di samping dua tombol unduh varian. */
  penjahit: { version: number; canEdit: boolean; items: PenjahitPlanItem[] };
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button
        type="button"
        className="w-full sm:w-auto"
        render={<a href={`/api/crm/purchase-order/${purchaseOrderId}/pdf?preview=1`} target="_blank" rel="noopener noreferrer" aria-label={`Lihat PDF customer ${purchaseOrderNo}`} />}
        nativeButton={false}
      >
        <Eye data-icon="inline-start" aria-hidden="true" />
        PDF Customer
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        render={<a href={`/api/crm/purchase-order/${purchaseOrderId}/pdf?preview=1&variant=penjahit`} target="_blank" rel="noopener noreferrer" aria-label={`Lihat PDF penjahit ${purchaseOrderNo}`} />}
        nativeButton={false}
      >
        <Eye data-icon="inline-start" aria-hidden="true" />
        PDF Penjahit
      </Button>
      <PenjahitPlanDialog purchaseOrderId={purchaseOrderId} purchaseOrderNo={purchaseOrderNo} version={penjahit.version} canEdit={penjahit.canEdit} items={penjahit.items} />
    </div>
  );
}
