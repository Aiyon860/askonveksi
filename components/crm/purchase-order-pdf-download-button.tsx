"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PurchaseOrderPdfDownloadButton({ purchaseOrderId, purchaseOrderNo }: { purchaseOrderId: string; purchaseOrderNo: string }) {
  return (
    <Button
      type="button"
      className="w-full sm:w-auto"
      render={<a href={`/api/crm/purchase-order/${purchaseOrderId}/pdf?preview=1`} target="_blank" rel="noopener noreferrer" aria-label={`Lihat PDF ${purchaseOrderNo}`} />}
      nativeButton={false}
    >
      <Eye data-icon="inline-start" aria-hidden="true" />
      Lihat PDF PO
    </Button>
  );
}
