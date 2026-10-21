"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Wallet } from "lucide-react";

import { recordPurchaseOrderDepositAction } from "@/app/actions/crm";
import { FilePicker } from "@/components/file-picker";
import { MoneyInput } from "@/components/money-input";
import { PaymentProofPreview } from "@/components/payment-proof-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toDateTimeLocalValue } from "@/lib/crm/format";

export type PurchaseOrderDepositValues = {
  amount: string;
  paidAt: Date | string;
  paymentMethodId: string | null;
  reference: string | null;
  note: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
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
 *
 * Field memakai state terkendali (bukan defaultValue) — perubahan default antar render
 * memicu warning Base UI "uncontrolled FieldControl" dan mengganggu siklus buka/tutup
 * dialog. Gagal simpan → error inline + dialog tetap terbuka; sukses → dialog tertutup
 * dan data dimuat ulang (tombol berubah jadi Ubah Deposit + Lihat Deposit muncul).
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const filled = deposit !== null;

  const [amount, setAmount] = useState(deposit?.amount ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(deposit?.paymentMethodId ?? "");
  const [paidAt, setPaidAt] = useState(() => (deposit ? toDateTimeLocalValue(deposit.paidAt) : ""));
  const [reference, setReference] = useState(deposit?.reference ?? "");
  const [note, setNote] = useState(deposit?.note ?? "");

  const [state, formAction, pending] = useActionState(async (prevState: { error: string | null; success: boolean }, formData: FormData) => {
    const result = await recordPurchaseOrderDepositAction(prevState, formData);
    // Simpan sukses: tutup dialog dan muat ulang data server — tombol berubah jadi
    // Ubah Deposit + Lihat Deposit muncul, tanpa teks tambahan agar baris tombol
    // tidak ikut bergeser. Sengaja di callback action, bukan useEffect, agar aturan
    // lint setState-in-effect terpenuhi dan sukses kedua ikut tertangani.
    if (result.success) {
      setOpen(false);
      router.refresh();
    }
    return result;
  }, { error: null, success: false });

  // Sinkronkan field dari data terbaru tiap dialog dibuka (deposit bisa saja baru diubah),
  // termasuk "sekarang" untuk PO tanpa deposit — dihitung saat klik, bukan saat render,
  // sehingga tidak ada defaultValue yang berubah antara SSR dan klien (warning Base UI).
  function openDepositDialog() {
    setAmount(deposit?.amount ?? "");
    setPaymentMethodId(deposit?.paymentMethodId ?? "");
    setPaidAt(deposit ? toDateTimeLocalValue(deposit.paidAt) : jakartaNowValue());
    setReference(deposit?.reference ?? "");
    setNote(deposit?.note ?? "");
    setOpen(true);
  }

  return (
    <>
      <div className="contents">
        {filled ? (
          <Button
            size="sm"
            variant="outline"
            className="w-auto"
            title="Lihat bukti deposit terbaru"
            onClick={() => setProofOpen(true)}
          >
            <Eye data-icon="inline-start" aria-hidden="true" />
            Lihat Deposit
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={filled ? "outline" : "default"}
          className="w-auto"
          disabled={!canEdit || undefined}
          title={canEdit ? undefined : "Deposit hanya dapat diubah saat PO masih draft."}
          onClick={openDepositDialog}
        >
          <Wallet data-icon="inline-start" aria-hidden="true" />
          {filled ? "Ubah Deposit" : "Isi Deposit"}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{purchaseOrderNo ? `Deposit desain ${purchaseOrderNo}` : "Deposit desain"}</DialogTitle>
            <DialogDescription>Catat deposit yang sudah diterima. Nominalnya dikurangkan dari sisa tagihan invoice.</DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`po-deposit-amount-${purchaseOrderId}`} required>Nominal deposit (Rp)</FieldLabel>
                <MoneyInput id={`po-deposit-amount-${purchaseOrderId}`} name="amount" required min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`po-deposit-method-${purchaseOrderId}`} required>Metode pembayaran</FieldLabel>
                  <NativeSelect id={`po-deposit-method-${purchaseOrderId}`} name="paymentMethodId" required value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)} className="w-full">
                    <NativeSelectOption value="" disabled>Pilih metode pembayaran</NativeSelectOption>
                    {methods.map((method) => (
                      <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`po-deposit-paid-at-${purchaseOrderId}`} required>Tanggal deposit</FieldLabel>
                  <Input id={`po-deposit-paid-at-${purchaseOrderId}`} name="paidAt" type="datetime-local" required max={jakartaNowValue()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`po-deposit-reference-${purchaseOrderId}`}>Referensi</FieldLabel>
                <Input id={`po-deposit-reference-${purchaseOrderId}`} name="reference" maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Nomor transfer atau keterangan singkat..." />
              </Field>
              <Field>
                <FieldLabel htmlFor={`po-deposit-note-${purchaseOrderId}`}>Catatan</FieldLabel>
                <Textarea id={`po-deposit-note-${purchaseOrderId}`} name="note" maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: DP desain bordir logo depan." />
              </Field>
              <Field>
                <FieldLabel required={!deposit?.proofFileName}>Bukti pembayaran</FieldLabel>
                <FilePicker suppliedId={`po-deposit-proof-${purchaseOrderId}`} required={!deposit?.proofFileName} />
                <p className="text-xs text-muted-foreground">Wajib untuk QRIS atau Bank. PDF, JPEG, PNG, atau WebP maksimal 5 MB.</p>
              </Field>
              {state.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Deposit belum tersimpan</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                  {pending ? "Menyimpan..." : filled ? "Simpan perubahan" : "Simpan deposit"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Bukti deposit {purchaseOrderNo}</DialogTitle>
            <DialogDescription>Bukti terbaru sesuai Isi / Ubah Deposit yang terakhir disimpan.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 pb-2 text-center">
            <PaymentProofPreview
              href={deposit?.proofFileName ? `/api/crm/purchase-order/${purchaseOrderId}/deposit/proof` : null}
              mimeType={deposit?.proofMimeType ?? null}
              label="Bukti deposit"
              thumbnailClassName="size-28"
            />
            {deposit?.proofFileName ? <p className="max-w-full truncate text-xs text-muted-foreground">{deposit.proofFileName}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
