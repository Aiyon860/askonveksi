"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

type SaveFileHandle = {
  createWritable(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<SaveFileHandle>;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PurchaseOrderPdfDownloadButton({ purchaseOrderId, purchaseOrderNo }: { purchaseOrderId: string; purchaseOrderNo: string }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const fileName = `purchase-order-${purchaseOrderNo}.pdf`;

  async function downloadPdf() {
    if (isDownloading) return;
    const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
    let fileHandle: SaveFileHandle | undefined;

    try {
      if (picker) {
        fileHandle = await picker({
          suggestedName: fileName,
          types: [{ description: "Dokumen PDF", accept: { "application/pdf": [".pdf"] } }],
        });
      }
      setIsDownloading(true);
      const response = await fetch(`/api/crm/purchase-order/${purchaseOrderId}/pdf?download=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("PDF PO belum dapat disiapkan.");
      const pdf = await response.blob();

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        try {
          await writable.write(pdf);
          await writable.close();
        } catch (error) {
          await writable.abort?.();
          throw error;
        }
      } else {
        downloadBlob(pdf, fileName);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Gagal mengunduh PDF PO", error);
      toast.add({ title: "PDF PO belum dapat diunduh", type: "error" });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button type="button" className="w-full sm:w-auto" onClick={downloadPdf} disabled={isDownloading}>
      {isDownloading ? <Spinner data-icon="inline-start" /> : <FileDown data-icon="inline-start" aria-hidden="true" />}
      {isDownloading ? "Menyiapkan PDF..." : "Unduh PDF PO"}
    </Button>
  );
}
