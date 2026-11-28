"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { PenjahitPlanSection, type PenjahitPlanItem } from "@/components/crm/penjahit-plan-section";

export type { PenjahitPlanItem };
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Tombol pembuka field penjahit (deadline, QTY & ukuran sample, gambar desain penjahit).
 * Isinya memakai `PenjahitPlanSection` yang mengisi semua isian dari data server, jadi
 * nilai lama selalu tampil dan tidak terhapus saat hanya mengubah salah satu field.
 */
export function PenjahitPlanDialog({
  purchaseOrderId,
  purchaseOrderNo,
  version,
  canEdit,
  items,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  version: number;
  canEdit: boolean;
  items: PenjahitPlanItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={!canEdit || undefined}
        title={canEdit ? undefined : "Deadline & desain penjahit hanya dapat diubah selama PO Draft atau Disepakati."}
        onClick={() => setOpen(true)}
      >
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit PDF Penjahit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-3xl lg:max-w-5xl">
            <DialogHeader className="shrink-0 pr-10">
              <DialogTitle>{purchaseOrderNo ? `Edit PDF Penjahit ${purchaseOrderNo}` : "Edit PDF Penjahit"}</DialogTitle>
              <DialogDescription>
                Deadline penjahit tiap produk (berbeda dari deadline customer), QTY &amp; ukuran sample, dan gambar desain penjahit.
              </DialogDescription>
            </DialogHeader>
            {/* Header tetap di tempat; hanya isi form yang bergulir. Modal dibuat lebar
                supaya dua kolom isian penjahit tidak berdesakan di layar besar. */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <PenjahitPlanSection
                purchaseOrderId={purchaseOrderId}
                purchaseOrderNo={purchaseOrderNo}
                version={version}
                items={items}
                onSaved={() => setOpen(false)}
              />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
