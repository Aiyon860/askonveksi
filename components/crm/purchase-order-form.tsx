"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createPurchaseOrderDraftAction, updatePurchaseOrderDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id: string;
  version: number;
  customerReference: string;
  productName: string;
  material: string;
  color: string;
  designNotes: string;
  notes: string;
  deadline: string;
  attachmentCount: number;
  sizes: Array<{ size: string; quantity: number }>;
};

type SizeRow = { key: string; size: string; quantity: number };

export function PurchaseOrderForm({ opportunityId, draft }: { opportunityId: string; draft?: Draft }) {
  const [sizes, setSizes] = useState<SizeRow[]>(
    (draft?.sizes.length ? draft.sizes : [{ size: "", quantity: 1 }]).map((item, index) => ({ ...item, key: `${index}-${item.size}` })),
  );
  const action = draft ? updatePurchaseOrderDraftAction : createPurchaseOrderDraftAction;

  return (
    <form action={action} encType="multipart/form-data">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {draft ? <input type="hidden" name="purchaseOrderId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`po-reference-${draft?.id ?? "new"}`}>Nomor PO customer</FieldLabel>
            <Input id={`po-reference-${draft?.id ?? "new"}`} name="customerReference" maxLength={120} defaultValue={draft?.customerReference ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-product-${draft?.id ?? "new"}`} required>Jenis pakaian</FieldLabel>
            <Input id={`po-product-${draft?.id ?? "new"}`} name="productName" required minLength={2} maxLength={120} defaultValue={draft?.productName ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-material-${draft?.id ?? "new"}`} required>Bahan</FieldLabel>
            <Input id={`po-material-${draft?.id ?? "new"}`} name="material" required minLength={2} maxLength={120} defaultValue={draft?.material ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-color-${draft?.id ?? "new"}`}>Warna</FieldLabel>
            <Input id={`po-color-${draft?.id ?? "new"}`} name="color" maxLength={120} defaultValue={draft?.color ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-deadline-${draft?.id ?? "new"}`}>Deadline customer</FieldLabel>
            <Input id={`po-deadline-${draft?.id ?? "new"}`} name="deadline" type="date" defaultValue={draft?.deadline ?? ""} />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Ukuran dan jumlah</p>
            <p className="mt-1 text-xs text-muted-foreground">Jumlah setiap ukuran dicatat terpisah.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={sizes.length >= 50} onClick={() => setSizes((current) => [...current, { key: `${Date.now()}-${current.length}`, size: "", quantity: 1 }])}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Tambah ukuran
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {sizes.map((item, index) => (
            <div key={item.key} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <Field>
                <FieldLabel htmlFor={`po-size-${item.key}`} required>Ukuran</FieldLabel>
                <Input id={`po-size-${item.key}`} name="size" required maxLength={40} defaultValue={item.size} placeholder="Contoh: M" />
              </Field>
              <Field>
                <FieldLabel htmlFor={`po-quantity-${item.key}`} required>Jumlah</FieldLabel>
                <Input id={`po-quantity-${item.key}`} name="sizeQuantity" type="number" required min={1} step={1} defaultValue={item.quantity} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ukuran ${index + 1}`} disabled={sizes.length === 1} onClick={() => setSizes((current) => current.filter((row) => row.key !== item.key))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`po-design-${draft?.id ?? "new"}`}>Catatan desain</FieldLabel>
            <Textarea id={`po-design-${draft?.id ?? "new"}`} name="designNotes" maxLength={4000} rows={4} defaultValue={draft?.designNotes ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`po-notes-${draft?.id ?? "new"}`}>Catatan lain</FieldLabel>
            <Textarea id={`po-notes-${draft?.id ?? "new"}`} name="notes" maxLength={4000} rows={4} defaultValue={draft?.notes ?? ""} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`po-attachments-${draft?.id ?? "new"}`}>Referensi desain</FieldLabel>
          <Input id={`po-attachments-${draft?.id ?? "new"}`} name="designAttachments" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" />
          <FieldDescription>JPG, PNG, WebP, atau PDF, maksimal 5 MB per file dan 5 file per revisi.{draft?.attachmentCount ? ` Saat ini ada ${draft.attachmentCount} lampiran.` : ""}</FieldDescription>
        </Field>
        <SubmitButton pendingLabel="Menyimpan PO...">{draft ? "Perbarui draft PO" : "Buat draft PO"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
