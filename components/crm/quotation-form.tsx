"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createQuotationDraftAction, updateQuotationDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Draft = {
  id: string;
  version: number;
  discountType: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountValue: string;
  items: Array<{ description: string; quantity: number; unitPrice: string }>;
};

type EditableItem = Draft["items"][number] & { key: string };

export function QuotationForm({ opportunityId, draft }: { opportunityId: string; draft?: Draft }) {
  const [items, setItems] = useState<EditableItem[]>(
    (draft?.items.length ? draft.items : [{ description: "", quantity: 1, unitPrice: "" }]).map((item, index) => ({ ...item, key: `${index}-${item.description}` })),
  );
  const [discountType, setDiscountType] = useState(draft?.discountType ?? "NONE");
  const action = draft ? updateQuotationDraftAction : createQuotationDraftAction;

  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {draft ? <input type="hidden" name="quotationId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Item penawaran</p>
            <p className="text-xs text-muted-foreground">Maksimal 50 item per quotation.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={items.length >= 50}
            onClick={() => setItems((current) => [...current, { key: `${Date.now()}-${current.length}`, description: "", quantity: 1, unitPrice: "" }])}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Tambah item
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.key} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto] sm:items-end">
              <Field>
                <FieldLabel htmlFor={`item-description-${item.key}`} required>Deskripsi</FieldLabel>
                <Input id={`item-description-${item.key}`} name="itemDescription" required minLength={2} maxLength={240} defaultValue={item.description} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`item-quantity-${item.key}`} required>Jumlah</FieldLabel>
                <Input id={`item-quantity-${item.key}`} name="itemQuantity" type="number" required min={1} step={1} defaultValue={item.quantity} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`item-price-${item.key}`} required>Harga satuan</FieldLabel>
                <Input id={`item-price-${item.key}`} name="itemUnitPrice" type="number" required min={0} step={1} defaultValue={item.unitPrice} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus item ${index + 1}`}
                disabled={items.length === 1}
                onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`discount-type-${draft?.id ?? "new"}`} required>Jenis diskon</FieldLabel>
            <NativeSelect
              id={`discount-type-${draft?.id ?? "new"}`}
              name="discountType"
              required
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as typeof discountType)}
              className="w-full"
            >
              <NativeSelectOption value="NONE">Tanpa diskon</NativeSelectOption>
              <NativeSelectOption value="NOMINAL">Nominal</NativeSelectOption>
              <NativeSelectOption value="PERCENTAGE">Persentase</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field data-disabled={discountType === "NONE"}>
            <FieldLabel htmlFor={`discount-value-${draft?.id ?? "new"}`} required={discountType !== "NONE"}>Nilai diskon</FieldLabel>
            <Input
              id={`discount-value-${draft?.id ?? "new"}`}
              name="discountValue"
              type="number"
              required={discountType !== "NONE"}
              min={0}
              max={discountType === "PERCENTAGE" ? 100 : undefined}
              step={discountType === "PERCENTAGE" ? "0.01" : "1"}
              defaultValue={discountType === "NONE" ? "0" : draft?.discountValue ?? "0"}
              disabled={discountType === "NONE"}
            />
            {discountType === "NONE" ? <input type="hidden" name="discountValue" value="0" /> : null}
          </Field>
        </div>
        <FieldDescription>Tax belum dihitung pada CRM v1 dan akan menjadi tanggung jawab modul invoice.</FieldDescription>
        <SubmitButton pendingLabel="Menyimpan draft...">{draft ? "Perbarui draft" : "Buat draft quotation"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
