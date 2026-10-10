"use client";

import { useActionState } from "react";

import { createInvoiceDraftAction, createInvoiceRevisionAction } from "@/app/actions/crm";
import { MoneyInput } from "@/components/money-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initialFormActionState } from "@/lib/actions/form-state";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  sizes: Array<{ id: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
};

type DraftItem = {
  productName?: string;
  description?: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG" | null;
  quantity: number;
  unitPrice: string;
  discountPercent?: string;
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
  const isAccessory = purchaseOrder.garmentType === "AKSESORI";
  const byKey = new Map(values?.items.map((item) => [`${item.sleeveLength ?? "PANJANG"}:${item.size.toLocaleLowerCase("id-ID")}`, item]));
  return (
    <form action={formAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {sourceInvoiceId ? <input type="hidden" name="sourceInvoiceId" value={sourceInvoiceId} /> : null}
      <FieldGroup>
        <Table containerClassName="rounded-lg border">
          <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="min-w-36">Harga</TableHead><TableHead className="min-w-24">Diskon %</TableHead></TableRow></TableHeader>
          <TableBody>{purchaseOrder.sizes.map((poItem) => {
            const key = `${poItem.sleeveLength}:${poItem.size.toLocaleLowerCase("id-ID")}`;
            const item = byKey.get(key);
            const defaultDescription = isAccessory ? purchaseOrder.productName : `${purchaseOrder.productName} ${poItem.sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${poItem.size}`;
            return <TableRow key={poItem.id}>
              <TableCell className="min-w-40"><Input name="itemProductName" required minLength={2} maxLength={120} defaultValue={item?.productName ?? purchaseOrder.productName} aria-label={`Produk ${defaultDescription}`} /><input type="hidden" name="itemPurchaseOrderSizeId" value={poItem.id} /><input type="hidden" name="itemSleeveLength" value={poItem.sleeveLength} /><input type="hidden" name="itemSize" value={poItem.size} /></TableCell>
              <TableCell className="min-w-56"><Textarea name="itemDescription" required minLength={2} maxLength={240} rows={2} defaultValue={item?.description ?? defaultDescription} aria-label={`Deskripsi ${defaultDescription}`} /></TableCell>
              <TableCell className="text-right font-mono tabular-nums">{poItem.quantity}<input type="hidden" name="itemQuantity" value={poItem.quantity} /></TableCell>
              <TableCell><MoneyInput name="itemUnitPrice" required min={0} step="0.01" defaultValue={item?.unitPrice ?? ""} aria-label={`Harga ${defaultDescription}`} /></TableCell>
              <TableCell><Input name="itemDiscountPercent" type="number" min={0} max={100} step="0.0001" defaultValue={item?.discountPercent ?? values?.discountPercent ?? "0"} aria-label={`Diskon ${defaultDescription}`} /></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field><FieldLabel htmlFor={`invoice-discount-${fieldKey}`}>Diskon default %</FieldLabel><Input id={`invoice-discount-${fieldKey}`} name="discountPercent" type="number" min={0} max={100} step="0.0001" defaultValue={values?.discountPercent ?? "0"} aria-label="Diskon default invoice" /><FieldDescription>Jadi acuan bila diskon per item kosong.</FieldDescription></Field>
          <Field><FieldLabel htmlFor={`invoice-tax-${fieldKey}`}>Pajak % (opsional)</FieldLabel><Input id={`invoice-tax-${fieldKey}`} name="taxPercent" type="number" min={0} max={100} step="0.0001" defaultValue={values?.taxPercent ?? "0"} aria-label="Pajak invoice" /></Field>
          <Field><FieldLabel htmlFor={`invoice-notes-${fieldKey}`}>Catatan invoice</FieldLabel><Textarea id={`invoice-notes-${fieldKey}`} name="notes" maxLength={2000} rows={3} defaultValue={values?.notes ?? ""} /></Field>
        </div>
        <FieldDescription>Harga akhir = jumlah harga satuan × qty, dikurangi diskon per item, ditambah pajak, lalu dibulatkan ke kelipatan Rp500 terdekat.</FieldDescription>
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
