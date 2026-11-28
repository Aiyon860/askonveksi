"use client";

import { useState } from "react";
import { Pencil, XCircle } from "lucide-react";

import { correctPurchaseOrderAction } from "@/app/actions/purchase-order-correction";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type PurchaseOrderCorrectionItem = {
  id: string;
  name: string;
  pola: string;
};

export type PurchaseOrderCorrectionRosterEntry = {
  id: string;
  /** Nama produk pemilik baris roster; kosong pada PO satu produk lawas. */
  itemName: string;
  memberId: string;
  name: string;
  jabatan: string;
};

/**
 * Koreksi data PO yang tidak dipakai perhitungan invoice: instansi, referensi customer,
 * deadline produksi (ikut menyamakan Work Order), deadline desain, pola per produk, dan
 * identitas roster (ID/nama/jabatan). Ukuran, jumlah, dan harga tetap terkunci sehingga
 * invoice yang sudah terbit tidak berubah.
 *
 * Form tampil inline di tab PO (bukan dialog) supaya admin melihat data PO yang sedang
 * dikoreksi. Field penjahit (deadline penjahit, QTY & ukuran sample, gambar) tetap lewat
 * tombol Edit PDF Penjahit agar tidak ada dua jalur simpan untuk data yang sama.
 */
export function PurchaseOrderCorrectionForm({
  purchaseOrderId,
  purchaseOrderNo,
  version,
  instansi,
  customerReference,
  deadline,
  designDeadline,
  items,
  roster,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  version: number;
  instansi: string;
  customerReference: string;
  deadline: string;
  /** `null` bila PO belum punya tugas desain. */
  designDeadline: string | null;
  items: PurchaseOrderCorrectionItem[];
  roster: PurchaseOrderCorrectionRosterEntry[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Koreksi data PO</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Instansi, referensi, deadline, pola, dan roster bisa diperbaiki tanpa membatalkan invoice.
            </p>
          </div>
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Edit data PO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={correctPurchaseOrderAction}
      onSubmit={() => setOpen(false)}
      className="rounded-lg border border-dashed p-4"
    >
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="version" value={version} />
      <FieldGroup>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{purchaseOrderNo ? `Edit data ${purchaseOrderNo}` : "Edit data PO"}</p>
          <p className="text-xs text-muted-foreground">
            Ukuran, jumlah, dan harga tidak diubah di sini karena dipakai invoice. Deadline penjahit, QTY, dan ukuran sample
            diubah lewat tombol Edit PDF Penjahit.
          </p>
        </div>

        <FieldSet className="rounded-lg border p-4">
          <FieldLegend>Identitas dokumen</FieldLegend>
          <Field>
            <FieldLabel htmlFor={`po-correction-instansi-${purchaseOrderId}`}>Instansi</FieldLabel>
            <Input
              id={`po-correction-instansi-${purchaseOrderId}`}
              name="instansi"
              defaultValue={instansi}
              maxLength={160}
              required
            />
            <FieldDescription>Tercetak pada PDF PO customer dan penjahit.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-correction-reference-${purchaseOrderId}`}>Referensi customer</FieldLabel>
            <Input
              id={`po-correction-reference-${purchaseOrderId}`}
              name="customerReference"
              defaultValue={customerReference}
              maxLength={120}
              placeholder="Nomor PO internal customer"
            />
          </Field>
        </FieldSet>

        <FieldSet className="rounded-lg border p-4">
          <FieldLegend>Deadline</FieldLegend>
          <Field>
            <FieldLabel htmlFor={`po-correction-deadline-${purchaseOrderId}`}>Deadline produksi</FieldLabel>
            <Input
              id={`po-correction-deadline-${purchaseOrderId}`}
              name="deadline"
              type="date"
              defaultValue={deadline}
              required
            />
            <FieldDescription>
              Ikut memperbarui deadline Work Order produksi yang masih aktif. Work Order selesai atau batal tidak diubah.
            </FieldDescription>
          </Field>
          {designDeadline !== null ? (
            <Field>
              <FieldLabel htmlFor={`po-correction-design-deadline-${purchaseOrderId}`}>Deadline desain</FieldLabel>
              <Input
                id={`po-correction-design-deadline-${purchaseOrderId}`}
                name="designDeadline"
                type="date"
                defaultValue={designDeadline}
                required
              />
            </Field>
          ) : null}
        </FieldSet>

        {items.length ? (
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>Pola per produk</FieldLegend>
            {items.map((item) => (
              <Field key={item.id}>
                <FieldLabel htmlFor={`po-correction-pola-${item.id}`}>{item.name}</FieldLabel>
                <Input
                  id={`po-correction-pola-${item.id}`}
                  name={`itemPola-${item.id}`}
                  defaultValue={item.pola}
                  maxLength={120}
                  placeholder="Contoh: Pola regular"
                />
              </Field>
            ))}
          </FieldSet>
        ) : null}

        {roster.length ? (
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>Roster pemakai ({roster.length})</FieldLegend>
            <FieldDescription>Hanya ID, nama, dan jabatan. Ukuran serta jumlah tetap seperti PO disepakati.</FieldDescription>
            <div className="max-h-80 overflow-y-auto rounded-lg border">
              <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,8rem)] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>ID</span>
                <span>Nama</span>
                <span>Jabatan</span>
              </div>
              <div className="divide-y">
                {roster.map((entry, index) => (
                  <div key={entry.id}>
                    {entry.itemName && entry.itemName !== roster[index - 1]?.itemName ? (
                      <p className="bg-muted/30 px-3 py-2 text-xs font-medium">{entry.itemName}</p>
                    ) : null}
                    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,8rem)] gap-2 px-3 py-2">
                      <Input
                        name={`rosterMemberId-${entry.id}`}
                        defaultValue={entry.memberId}
                        maxLength={80}
                        required
                        aria-label={`ID roster ${entry.memberId}`}
                      />
                      <Input
                        name={`rosterName-${entry.id}`}
                        defaultValue={entry.name}
                        maxLength={160}
                        required
                        aria-label={`Nama roster ${entry.name}`}
                      />
                      <Input
                        name={`rosterJabatan-${entry.id}`}
                        defaultValue={entry.jabatan}
                        maxLength={80}
                        aria-label={`Jabatan roster ${entry.name}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FieldSet>
        ) : null}

        <Field>
          <FieldLabel htmlFor={`po-correction-reason-${purchaseOrderId}`}>Alasan koreksi</FieldLabel>
          <Textarea
            id={`po-correction-reason-${purchaseOrderId}`}
            name="reason"
            maxLength={2000}
            rows={2}
            placeholder="Contoh: koreksi nama roster dari customer."
          />
          <FieldDescription>Opsional. Disimpan pada riwayat aktivitas PO.</FieldDescription>
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            <XCircle data-icon="inline-start" aria-hidden="true" />
            Batal
          </Button>
          <Button type="submit" className="w-full sm:w-auto">Simpan koreksi</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
