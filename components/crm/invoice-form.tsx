"use client";

import { createInvoiceDraftAction, updateInvoiceDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
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
  discountCapAmount: string;
  taxRate: string;
};

type Draft = { id: string; version: number; dueAt: string; notes: string; items: DraftItem[] };

export function InvoiceForm({ opportunityId, purchaseOrder, draft }: { opportunityId: string; purchaseOrder: PurchaseOrder; draft?: Draft }) {
  const action = draft ? updateInvoiceDraftAction : createInvoiceDraftAction;
  const byKey = new Map(draft?.items.map((item) => [`${item.sleeveLength ?? "PANJANG"}:${item.size.toLocaleLowerCase("id-ID")}`, item]));
  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {draft ? <input type="hidden" name="invoiceId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <div><p className="text-sm font-medium">Harga berdasarkan {purchaseOrder.purchaseOrderNo}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Produk, deskripsi, ukuran, model lengan, dan jumlah dikunci dari PO. Revisi PO jika spesifikasi berubah.</p></div>
        <Table containerClassName="rounded-lg border">
          <TableHeader><TableRow><TableHead>Produk / deskripsi</TableHead><TableHead>Model</TableHead><TableHead>Ukuran</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="min-w-36">Harga</TableHead><TableHead className="min-w-32">Diskon %</TableHead><TableHead className="min-w-36">Batas diskon</TableHead><TableHead className="min-w-28">Pajak %</TableHead></TableRow></TableHeader>
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
              <TableCell><Input name="itemDiscountCapAmount" type="number" min={0} step="0.01" defaultValue={item?.discountCapAmount ?? ""} placeholder="Tanpa batas" aria-label={`Batas nominal diskon ${description}`} /></TableCell>
              <TableCell><Input name="itemTaxRate" type="number" required min={0} max={100} step="0.0001" defaultValue={item?.taxRate ?? "0"} aria-label={`Pajak persen ${description}`} /></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`invoice-due-${draft?.id ?? "new"}`}>Jatuh tempo</FieldLabel><Input id={`invoice-due-${draft?.id ?? "new"}`} name="dueAt" type="date" defaultValue={draft?.dueAt ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`invoice-notes-${draft?.id ?? "new"}`}>Catatan invoice</FieldLabel><Textarea id={`invoice-notes-${draft?.id ?? "new"}`} name="notes" maxLength={2000} rows={3} defaultValue={draft?.notes ?? ""} /></Field>
        </div>
        <FieldDescription>Diskon dihitung dari harga kotor per baris dan dibatasi nominal bila diisi. Pajak dihitung setelah diskon.</FieldDescription>
        <SubmitButton pendingLabel="Menyimpan draft...">{draft ? "Perbarui draft invoice" : "Buat draft invoice"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
