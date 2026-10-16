"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PurchaseOrderPdfDownloadButton({ purchaseOrderId, purchaseOrderNo }: { purchaseOrderId: string; purchaseOrderNo: string }) {
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
    </div>
  );
}
