"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { updatePurchaseOrderDesignNotesAction } from "@/app/actions/design";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export type PurchaseOrderDesignNotesItem = {
  id: string;
  name: string;
  /** Catatan NOTE produk — tercetak di PDF customer & penjahit. */
  designNotes: string;
};

/**
 * Edit desain customer & catatan PO setelah PO disepakati. Ukuran, jumlah, dan harga
 * tetap terkunci karena invoice sudah memakai angka tersebut; desain dan catatan tidak
 * memengaruhi nilai invoice, jadi boleh diperbaiki walau invoice sudah terbit.
 *
 * Desain penjahit (gambar sampel, deadline, QTY & ukuran sample) tetap lewat tombol
 * "Edit PDF Penjahit" di sampingnya.
 */
export function PurchaseOrderDesignNotesDialog({
  purchaseOrderId,
  purchaseOrderNo,
  version,
  designNotes,
  notes,
  items,
  canUploadDesign,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  version: number;
  designNotes: string;
  notes: string;
  items: PurchaseOrderDesignNotesItem[];
  /** Admin PO/Admin Customer + PO punya tugas desain; catatan tetap bisa diubah bila false. */
  canUploadDesign: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit desain &amp; catatan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{purchaseOrderNo ? `Edit desain & catatan ${purchaseOrderNo}` : "Edit desain & catatan"}</DialogTitle>
            <DialogDescription>
              Hanya desain customer dan catatan yang berubah. Ukuran, jumlah, dan harga PO tetap, jadi invoice yang sudah terbit tidak
              terpengaruh. Desain penjahit diubah lewat tombol Edit PDF Penjahit.
            </DialogDescription>
          </DialogHeader>
          <form action={updatePurchaseOrderDesignNotesAction} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
            <input type="hidden" name="version" value={version} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`po-design-notes-${purchaseOrderId}`}>Catatan desain PO</FieldLabel>
                <Textarea
                  id={`po-design-notes-${purchaseOrderId}`}
                  name="designNotes"
                  defaultValue={designNotes}
                  maxLength={4000}
                  rows={3}
                  placeholder="Catatan desain umum yang dipakai bila produk belum punya catatan sendiri."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`po-notes-${purchaseOrderId}`}>Catatan lain</FieldLabel>
                <Textarea id={`po-notes-${purchaseOrderId}`} name="notes" defaultValue={notes} maxLength={4000} rows={3} />
              </Field>
              {items.map((item) => {
                const filesId = `po-item-design-${purchaseOrderId}-${item.id}`;
                const notesId = `po-item-notes-${purchaseOrderId}-${item.id}`;
                return (
                  <FieldSet key={item.id} className="rounded-lg border p-4">
                    <FieldLegend>{item.name}</FieldLegend>
                    <Field>
                      <FieldLabel htmlFor={notesId}>Catatan NOTE produk</FieldLabel>
                      <Textarea
                        id={notesId}
                        name={`itemNotes-${item.id}`}
                        defaultValue={item.designNotes}
                        maxLength={4000}
                        rows={3}
                        placeholder="Contoh: Logo bordir dada kiri."
                      />
                      <FieldDescription>Tercetak sebagai baris NOTE di PDF customer dan PDF penjahit.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={filesId}>Gambar desain customer</FieldLabel>
                      <FilePicker
                        id={filesId}
                        name={`designFiles-${item.id}`}
                        multiple
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        disabled={!canUploadDesign || undefined}
                        emptyLabel={canUploadDesign ? "Belum ada file baru" : "Unggah desain tidak tersedia"}
                      />
                      <FieldDescription>
                        {canUploadDesign
                          ? "Opsional. PNG atau JPG, maksimal 5 file dan 5 MB per file; file baru disimpan sebagai versi desain terbaru."
                          : "Catatan tetap bisa diubah, tetapi unggah desain tidak tersedia untuk akun ini."}
                      </FieldDescription>
                    </Field>
                  </FieldSet>
                );
              })}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="submit">Simpan perubahan</Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
