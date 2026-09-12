"use client";

import { useActionState } from "react";

import { createInvoiceDraftAction, createInvoiceRevisionAction, updateInvoiceDraftAction } from "@/app/actions/crm";
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
  sizes: Array<{ id: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
};

type DraftItem = {
  size: string;
  sleeveLength: "PENDEK" | "PANJANG" | null;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
};

type InvoiceFormValues = { notes: string; taxRate: string; items: DraftItem[] };
type Draft = InvoiceFormValues & { id: string; version: number };

export function InvoiceForm({
  opportunityId,
  purchaseOrder,
  draft,
  initialValues,
  sourceInvoiceId,
  submitLabel,
}: {
  opportunityId: string;
  purchaseOrder: PurchaseOrder;
  draft?: Draft;
  initialValues?: InvoiceFormValues;
  sourceInvoiceId?: string;
  submitLabel?: string;
}) {
  const serverAction = draft ? updateInvoiceDraftAction : sourceInvoiceId ? createInvoiceRevisionAction : createInvoiceDraftAction;
  const [formState, formAction] = useActionState(serverAction, initialFormActionState);
  const values = draft ?? initialValues;
  const fieldKey = draft?.id ?? sourceInvoiceId ?? "new";
  const byKey = new Map(values?.items.map((item) => [`${item.sleeveLength ?? "PANJANG"}:${item.size.toLocaleLowerCase("id-ID")}`, item]));
  return (
    <form action={formAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {sourceInvoiceId ? <input type="hidden" name="sourceInvoiceId" value={sourceInvoiceId} /> : null}
      {draft ? <input type="hidden" name="invoiceId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <Table containerClassName="rounded-lg border">
          <TableHeader><TableRow><TableHead>Produk / deskripsi</TableHead><TableHead>Model</TableHead><TableHead>Ukuran</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="min-w-36">Harga</TableHead><TableHead className="min-w-32">Diskon %</TableHead></TableRow></TableHeader>
          <TableBody>{purchaseOrder.sizes.map((poItem) => {
            const key = `${poItem.sleeveLength}:${poItem.size.toLocaleLowerCase("id-ID")}`;
            const item = byKey.get(key);
            const description = `${purchaseOrder.productName} ${poItem.sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${poItem.size}`;
            return <TableRow key={poItem.id}>
              <TableCell className="min-w-64"><p className="font-medium">{purchaseOrder.productName}</p><p className="text-xs text-muted-foreground">{description}</p><input type="hidden" name="itemPurchaseOrderSizeId" value={poItem.id} /><input type="hidden" name="itemProductName" value={purchaseOrder.productName} /><input type="hidden" name="itemDescription" value={description} /></TableCell>
              <TableCell>{poItem.sleeveLength === "PENDEK" ? "Pendek" : "Panjang"}<input type="hidden" name="itemSleeveLength" value={poItem.sleeveLength} /></TableCell>
              <TableCell>{poItem.size}<input type="hidden" name="itemSize" value={poItem.size} /></TableCell>
              <TableCell className="text-right font-mono tabular-nums">{poItem.quantity}<input type="hidden" name="itemQuantity" value={poItem.quantity} /></TableCell>
              <TableCell><Input name="itemUnitPrice" type="number" required min={0} step="0.01" defaultValue={item?.unitPrice ?? ""} aria-label={`Harga ${description}`} /></TableCell>
              <TableCell><Input name="itemDiscountPercent" type="number" required min={0} max={100} step="0.0001" defaultValue={item?.discountPercent ?? "0"} aria-label={`Diskon persen ${description}`} /></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`invoice-tax-${fieldKey}`}>Pajak %</FieldLabel><Input id={`invoice-tax-${fieldKey}`} name="taxRate" type="number" required min={0} max={100} step="0.0001" defaultValue={values?.taxRate ?? "0"} aria-label="Pajak persen" /></Field>
          <Field><FieldLabel htmlFor={`invoice-notes-${fieldKey}`}>Catatan invoice</FieldLabel><Textarea id={`invoice-notes-${fieldKey}`} name="notes" maxLength={2000} rows={3} defaultValue={values?.notes ?? ""} /></Field>
        </div>
        <FieldDescription>Diskon dihitung dari harga kotor per baris. Pajak dikenakan pada keseluruhan order setelah diskon.</FieldDescription>
        {formState.ok === false && formState.message ? (
          <Alert variant="destructive">
            <AlertTitle>Invoice belum tersimpan</AlertTitle>
            <AlertDescription>{formState.message} Periksa harga, diskon, dan pajak, lalu simpan ulang. Isian Anda tidak hilang.</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Menyimpan draft...">{submitLabel ?? (draft ? "Perbarui draft invoice" : "Buat draft invoice")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
