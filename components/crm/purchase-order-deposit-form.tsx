"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";

import { recordPurchaseOrderDepositAction } from "@/app/actions/crm";
import { FilePicker } from "@/components/file-picker";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toDateTimeLocalValue } from "@/lib/crm/format";

export type PurchaseOrderDepositValues = {
  amount: string;
  paidAt: Date | string;
  paymentMethodId: string | null;
  reference: string | null;
  note: string | null;
  proofFileName: string | null;
};

function jakartaNowValue() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

/**
 * Deposit desain dicatat langsung pada PO (sebelum invoice ada) lewat dialog ini.
 * Tombol ini hanya tampil untuk PO yang checkbox Deposit-nya dicentang, dan nominalnya
 * mengurangi sisa tagihan invoice saat jadwal pembayaran disusun.
 */
export function PurchaseOrderDepositAction({
  purchaseOrderId,
  purchaseOrderNo,
  deposit,
  methods,
  canEdit,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  deposit: PurchaseOrderDepositValues | null;
  methods: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const filled = deposit !== null;

  return (
    <>
      <Button
        size="sm"
        variant={filled ? "outline" : "default"}
        className="w-auto"
        disabled={!canEdit || undefined}
        title={canEdit ? undefined : "Deposit hanya dapat diubah saat PO masih draft."}
        onClick={() => setOpen(true)}
      >
        <Wallet data-icon="inline-start" aria-hidden="true" />
        {filled ? "Ubah Deposit" : "Isi Deposit"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{purchaseOrderNo ? `Deposit desain ${purchaseOrderNo}` : "Deposit desain"}</DialogTitle>
            <DialogDescription>Catat deposit yang sudah diterima. Nominalnya dikurangkan dari sisa tagihan invoice.</DialogDescription>
          </DialogHeader>
          <form action={recordPurchaseOrderDepositAction} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`po-deposit-amount-${purchaseOrderId}`} required>Nominal deposit (Rp)</FieldLabel>
                <MoneyInput id={`po-deposit-amount-${purchaseOrderId}`} name="amount" required min="0.01" step="0.01" defaultValue={deposit?.amount ?? ""} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`po-deposit-method-${purchaseOrderId}`} required>Metode pembayaran</FieldLabel>
                  <NativeSelect id={`po-deposit-method-${purchaseOrderId}`} name="paymentMethodId" required defaultValue={deposit?.paymentMethodId ?? ""} className="w-full">
                    <NativeSelectOption value="" disabled>Pilih metode pembayaran</NativeSelectOption>
                    {methods.map((method) => (
                      <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`po-deposit-paid-at-${purchaseOrderId}`} required>Tanggal deposit</FieldLabel>
                  <Input id={`po-deposit-paid-at-${purchaseOrderId}`} name="paidAt" type="datetime-local" required max={jakartaNowValue()} defaultValue={deposit ? toDateTimeLocalValue(deposit.paidAt) : jakartaNowValue()} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`po-deposit-reference-${purchaseOrderId}`}>Referensi</FieldLabel>
                <Input id={`po-deposit-reference-${purchaseOrderId}`} name="reference" maxLength={120} defaultValue={deposit?.reference ?? ""} placeholder="Nomor transfer atau keterangan singkat..." />
              </Field>
              <Field>
                <FieldLabel htmlFor={`po-deposit-note-${purchaseOrderId}`}>Catatan</FieldLabel>
                <Textarea id={`po-deposit-note-${purchaseOrderId}`} name="note" maxLength={1000} rows={2} defaultValue={deposit?.note ?? ""} placeholder="Contoh: DP desain bordir logo depan." />
              </Field>
              <Field>
                <FieldLabel required={!deposit?.proofFileName}>Bukti pembayaran</FieldLabel>
                <FilePicker suppliedId={`po-deposit-proof-${purchaseOrderId}`} required={!deposit?.proofFileName} />
                <p className="text-xs text-muted-foreground">Wajib untuk QRIS atau Bank. PDF, JPEG, PNG, atau WebP maksimal 5 MB.</p>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="submit">{filled ? "Simpan perubahan" : "Simpan deposit"}</Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
