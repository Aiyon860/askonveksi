"use client";

import { useActionState, useState, Fragment } from "react";
import { Plus, X } from "lucide-react";

import { createInvoiceDraftAction, createInvoiceRevisionAction } from "@/app/actions/crm";
import { MoneyInput } from "@/components/money-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initialFormActionState } from "@/lib/actions/form-state";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const MAX_ADDONS_PER_ROW = 5;

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  items?: Array<{ id: string; name: string; garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null }>;
  sizes: Array<{ id: string; itemId?: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
};

type DraftAddon = {
  label?: string;
  amount?: string;
};

type DraftItem = {
  productName?: string;
  description?: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG" | null;
  quantity: number;
  unitPrice: string;
  discountPercent?: string;
  addons?: DraftAddon[];
};

type InvoiceFormValues = { notes: string; discountPercent: string; taxPercent?: string; items: DraftItem[] };

export function InvoiceForm({
  opportunityId,
  purchaseOrder,
  initialValues,
  sourceInvoiceId,
  submitLabel,
}: {
  opportunityId: string;
  purchaseOrder: PurchaseOrder;
  initialValues?: InvoiceFormValues;
  sourceInvoiceId?: string;
  submitLabel?: string;
}) {
  const serverAction = sourceInvoiceId ? createInvoiceRevisionAction : createInvoiceDraftAction;
  const [formState, formAction] = useActionState(serverAction, initialFormActionState);
  const values = initialValues;
  const fieldKey = sourceInvoiceId ?? "new";
  const itemNameById = new Map((purchaseOrder.items ?? []).map((item) => [item.id, item.name]));
  const itemGarmentById = new Map((purchaseOrder.items ?? []).map((item) => [item.id, item.garmentType ?? purchaseOrder.garmentType]));
  const rowProductName = (poItem: { itemId?: string }) => (poItem.itemId && itemNameById.get(poItem.itemId)) || purchaseOrder.productName;
  const rowIsAccessory = (poItem: { itemId?: string }) => (poItem.itemId ? (itemGarmentById.get(poItem.itemId) ?? purchaseOrder.garmentType) : purchaseOrder.garmentType) === "AKSESORI";
  const byKey = new Map(values?.items.map((item) => [`${item.sleeveLength ?? "PANJANG"}:${item.size.toLocaleLowerCase("id-ID")}`, item]));
  return (
    <form action={formAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {sourceInvoiceId ? <input type="hidden" name="sourceInvoiceId" value={sourceInvoiceId} /> : null}
      <FieldGroup>
        <Table containerClassName="rounded-lg border">
          <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="min-w-36">Harga</TableHead><TableHead className="min-w-24">Diskon %</TableHead></TableRow></TableHeader>
          <TableBody>{purchaseOrder.sizes.map((poItem, rowIndex) => {
            const key = `${poItem.sleeveLength}:${poItem.size.toLocaleLowerCase("id-ID")}`;
            const item = byKey.get(key);
            const rowName = rowProductName(poItem);
            const accessory = rowIsAccessory(poItem);
            const sizeCaption = `${poItem.sleeveLength === "PENDEK" ? "Pendek" : "Panjang"} · ${poItem.size}`;
            const defaultDescription = accessory ? rowName : `${rowName} ${poItem.sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${poItem.size}`;
            return <Fragment key={poItem.id}>
              <TableRow>
                <TableCell className="min-w-40 align-top">
                  <Input name="itemProductName" required minLength={2} maxLength={120} defaultValue={item?.productName ?? rowName} aria-label={`Produk ${defaultDescription}`} />
                  {!accessory ? <p className="mt-1 text-xs text-muted-foreground">{sizeCaption}</p> : null}
                  <input type="hidden" name="itemPurchaseOrderSizeId" value={poItem.id} /><input type="hidden" name="itemSleeveLength" value={poItem.sleeveLength} /><input type="hidden" name="itemSize" value={poItem.size} />
                </TableCell>
                <TableCell className="min-w-56 align-top"><Textarea name="itemDescription" maxLength={240} rows={1} defaultValue={item?.description ?? ""} placeholder="Deskripsi opsional..." aria-label={`Deskripsi ${defaultDescription}`} className="min-h-9 resize-y" /></TableCell>
                <TableCell className="text-right font-mono tabular-nums align-top">{poItem.quantity}<input type="hidden" name="itemQuantity" value={poItem.quantity} /></TableCell>
                <TableCell className="align-top"><MoneyInput name="itemUnitPrice" required min={0} step="0.01" defaultValue={item?.unitPrice ?? ""} aria-label={`Harga ${defaultDescription}`} /></TableCell>
                <TableCell className="align-top"><Input name="itemDiscountPercent" type="number" min={0} max={100} step="0.0001" defaultValue={item?.discountPercent ?? values?.discountPercent ?? "0"} aria-label={`Diskon ${defaultDescription}`} /></TableCell>
              </TableRow>
              <RowAddons rowIndex={rowIndex} rowLabel={`${rowName}${accessory ? "" : ` ${sizeCaption}`}`} initialAddons={item?.addons} />
            </Fragment>;
          })}</TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field><FieldLabel htmlFor={`invoice-discount-${fieldKey}`}>Diskon default %</FieldLabel><Input id={`invoice-discount-${fieldKey}`} name="discountPercent" type="number" min={0} max={100} step="0.0001" defaultValue={values?.discountPercent ?? "0"} aria-label="Diskon default invoice" /><FieldDescription>Jadi acuan bila diskon per item kosong.</FieldDescription></Field>
          <Field><FieldLabel htmlFor={`invoice-tax-${fieldKey}`}>Pajak % (opsional)</FieldLabel><Input id={`invoice-tax-${fieldKey}`} name="taxPercent" type="number" min={0} max={100} step="0.0001" defaultValue={values?.taxPercent ?? "0"} aria-label="Pajak invoice" /></Field>
          <Field><FieldLabel htmlFor={`invoice-notes-${fieldKey}`}>Catatan invoice</FieldLabel><Textarea id={`invoice-notes-${fieldKey}`} name="notes" maxLength={2000} rows={3} defaultValue={values?.notes ?? ""} /></Field>
        </div>
        <FieldDescription>Harga akhir = jumlah harga satuan × qty ditambah add on per baris, dikurangi diskon per item, ditambah pajak, lalu dibulatkan ke kelipatan Rp500 terdekat.</FieldDescription>
        {formState.ok === false && formState.message ? (
          <Alert variant="destructive">
            <AlertTitle>Invoice belum tersimpan</AlertTitle>
            <AlertDescription>{formState.message} Periksa harga dan diskon, lalu simpan ulang. Isian Anda tidak hilang.</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Menyimpan draft...">{submitLabel ?? "Buat draft invoice"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}

type AddonDraft = { key: string; label: string; amount: string };

function RowAddons({ rowIndex, rowLabel, initialAddons }: { rowIndex: number; rowLabel: string; initialAddons?: DraftAddon[] }) {
  const [addons, setAddons] = useState<AddonDraft[]>(() =>
    (initialAddons ?? []).slice(0, MAX_ADDONS_PER_ROW).map((addon, index) => ({
      key: `saved-${index}`,
      label: addon.label ?? "",
      amount: addon.amount ?? "",
    })),
  );
  const [open, setOpen] = useState(addons.length > 0);
  if (!open && addons.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="border-t-0 pt-0">
          <Button type="button" variant="outline" size="sm" onClick={() => { setAddons([{ key: `new-${Date.now()}`, label: "", amount: "" }]); setOpen(true); }} aria-label={`Tambah add on untuk ${rowLabel}`}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add On
          </Button>
        </TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow>
      <TableCell colSpan={5} className="border-t-0 bg-muted/40 pt-0">
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Add On · {rowLabel} <span className="font-normal">(harga per pcs, dikali qty baris)</span></p>
          {addons.map((addon, addonIndex) => (
            <div key={addon.key} className="grid items-start gap-2 sm:grid-cols-[1fr_12rem_2.5rem]">
              <Input
                name={`item-${rowIndex}-addon-label`}
                required
                minLength={2}
                maxLength={120}
                defaultValue={addon.label}
                placeholder="Keterangan add on, mis. Kerah"
                aria-label={`Keterangan add on ${addonIndex + 1} untuk ${rowLabel}`}
              />
              <MoneyInput
                name={`item-${rowIndex}-addon-amount`}
                required
                min={0}
                step="0.01"
                defaultValue={addon.amount}
                aria-label={`Harga add on ${addonIndex + 1} untuk ${rowLabel}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const next = addons.filter((entry) => entry.key !== addon.key);
                  setAddons(next);
                  if (next.length === 0) setOpen(false);
                }}
                aria-label={`Hapus add on ${addonIndex + 1} untuk ${rowLabel}`}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          {addons.length < MAX_ADDONS_PER_ROW ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setAddons((current) => [...current, { key: `new-${Date.now()}-${current.length}`, label: "", amount: "" }])}
              aria-label={`Tambah add on lagi untuk ${rowLabel}`}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add On
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
