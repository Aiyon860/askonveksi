"use client";

import { useState } from "react";

import { createInvoiceDraftAction, updateInvoiceDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  sizes: Array<{ size: string; quantity: number }>;
};

type Draft = {
  id: string;
  version: number;
  dueAt: string;
  notes: string;
  discountType: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountValue: string;
  items: Array<{ size: string; description: string; quantity: number; unitPrice: string }>;
};

export function InvoiceForm({ opportunityId, purchaseOrder, draft }: { opportunityId: string; purchaseOrder: PurchaseOrder; draft?: Draft }) {
  const [discountType, setDiscountType] = useState(draft?.discountType ?? "NONE");
  const action = draft ? updateInvoiceDraftAction : createInvoiceDraftAction;
  const draftBySize = new Map(draft?.items.map((item) => [item.size.toLocaleLowerCase("id-ID"), item]));

  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {draft ? <input type="hidden" name="invoiceId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <div>
          <p className="text-sm font-medium">Harga berdasarkan {purchaseOrder.purchaseOrderNo}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Ukuran dan jumlah dikunci mengikuti PO yang sudah disepakati.</p>
        </div>

        <div className="flex flex-col gap-3">
          {purchaseOrder.sizes.map((poItem, index) => {
            const item = draftBySize.get(poItem.size.toLocaleLowerCase("id-ID"));
            const key = `${poItem.size}-${index}`;
            return (
              <div key={key} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_10rem] sm:items-end">
                <Field>
                  <FieldLabel htmlFor={`invoice-size-${key}`}>Ukuran</FieldLabel>
                  <Input id={`invoice-size-${key}`} value={poItem.size} readOnly aria-readonly="true" />
                  <input type="hidden" name="itemSize" value={poItem.size} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`invoice-quantity-${key}`}>Jumlah</FieldLabel>
                  <Input id={`invoice-quantity-${key}`} value={poItem.quantity} readOnly aria-readonly="true" />
                  <input type="hidden" name="itemQuantity" value={poItem.quantity} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`invoice-description-${key}`} required>Deskripsi</FieldLabel>
                  <Input id={`invoice-description-${key}`} name="itemDescription" required minLength={2} maxLength={240} defaultValue={item?.description ?? `${purchaseOrder.productName} ukuran ${poItem.size}`} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`invoice-price-${key}`} required>Harga satuan</FieldLabel>
                  <Input id={`invoice-price-${key}`} name="itemUnitPrice" type="number" required min={0} step="0.01" defaultValue={item?.unitPrice ?? ""} />
                </Field>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`invoice-due-${draft?.id ?? "new"}`}>Jatuh tempo</FieldLabel>
            <Input id={`invoice-due-${draft?.id ?? "new"}`} name="dueAt" type="date" defaultValue={draft?.dueAt ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`discount-type-${draft?.id ?? "new"}`} required>Jenis diskon</FieldLabel>
            <NativeSelect id={`discount-type-${draft?.id ?? "new"}`} name="discountType" required value={discountType} onChange={(event) => setDiscountType(event.target.value as typeof discountType)} className="w-full">
              <NativeSelectOption value="NONE">Tanpa diskon</NativeSelectOption>
              <NativeSelectOption value="NOMINAL">Nominal</NativeSelectOption>
              <NativeSelectOption value="PERCENTAGE">Persentase</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field data-disabled={discountType === "NONE"}>
            <FieldLabel htmlFor={`discount-value-${draft?.id ?? "new"}`} required={discountType !== "NONE"}>Nilai diskon</FieldLabel>
            <Input id={`discount-value-${draft?.id ?? "new"}`} name="discountValue" type="number" required={discountType !== "NONE"} min={0} max={discountType === "PERCENTAGE" ? 100 : undefined} step="0.01" defaultValue={discountType === "NONE" ? "0" : draft?.discountValue ?? "0"} disabled={discountType === "NONE"} />
            {discountType === "NONE" ? <input type="hidden" name="discountValue" value="0" /> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`invoice-notes-${draft?.id ?? "new"}`}>Catatan invoice</FieldLabel>
            <Textarea id={`invoice-notes-${draft?.id ?? "new"}`} name="notes" maxLength={2000} rows={3} defaultValue={draft?.notes ?? ""} />
          </Field>
        </div>
        <FieldDescription>Invoice menggunakan IDR. Pajak dan pelunasan aktual belum dicatat pada versi CRM ini.</FieldDescription>
        <SubmitButton pendingLabel="Menyimpan draft...">{draft ? "Perbarui draft invoice" : "Buat draft invoice"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
