"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { editInvoicePaymentTransactionAction, payInvoicePaymentTermAction, voidInvoicePaymentTransactionAction } from "@/app/actions/crm";
import { invoiceDetailAction } from "@/app/actions/crm-details";
import { DocumentDetailTrigger } from "@/components/crm/document-detail-trigger";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";

type Detail = Awaited<ReturnType<typeof invoiceDetailAction>>;
type Payment = NonNullable<NonNullable<Detail>["salesOrder"]>;

export function InvoiceDetail({ id, children, triggerClassName, triggerVariant }: { id: string; children: React.ReactNode; triggerClassName?: string; triggerVariant?: "preview" | "table-row" }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);

  async function loadDetail() {
    try {
      setDetail(await invoiceDetailAction(id));
      setError(false);
    } catch {
      setError(true);
    }
  }

  function showDetail() {
    setOpen(true);
    if (!detail) void loadDetail();
  }

  return <>
    <DocumentDetailTrigger className={triggerClassName} onActivate={showDetail} variant={triggerVariant}>{children}</DocumentDetailTrigger>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Detail invoice</DialogTitle><DialogDescription>Nilai tagihan, jadwal pembayaran, dan status pelunasan.</DialogDescription></DialogHeader>
        {!detail && !error ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Spinner /> Memuat detail...</div> : null}
        {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail invoice tidak dapat dimuat.</p> : null}
        {detail ? <div className="flex flex-col gap-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="No. Invoice" value={detail.invoiceNo} mono /><Info label="No. PO" value={detail.purchaseOrder.purchaseOrderNo} mono />
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><InvoiceStatusBadge status={detail.status} /></dd></div>
            <Info label="Customer" value={detail.snapshotCompanyName ?? detail.snapshotCustomerName} /><Info label="Tanggal dibuat" value={formatDate(detail.createdAt)} /><Info label="Jatuh tempo" value={formatDate(detail.dueAt)} />
          </dl>
          <Table><TableHeader><TableRow><TableHead>Ukuran</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader><TableBody>{detail.items.map((item) => <TableRow key={item.id}><TableCell>{item.size}</TableCell><TableCell>{item.description}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.subtotal)}</TableCell></TableRow>)}</TableBody></Table>
          <dl className="ml-auto grid w-full gap-2 sm:max-w-xs"><Total label="Subtotal" value={formatCurrency(detail.subtotal)} /><Total label="Diskon" value={detail.discountType === "PERCENTAGE" ? `${detail.discountValue}%` : formatCurrency(detail.discountValue)} /><Total label="Total" value={formatCurrency(detail.total)} strong /></dl>
          {detail.salesOrder ? <PaymentSummary payment={detail.salesOrder} methods={detail.paymentMethods} canRecord={detail.canRecordPayment} onRecorded={loadDetail} /> : null}
          {detail.notes ? <Info label="Catatan" value={detail.notes} /> : null}
        </div> : null}
        {detail ? <DialogFooter><Button nativeButton={false} render={<Link href={`/crm/peluang/${detail.opportunity.id}?tab=invoice`} />}>Lihat Invoice</Button></DialogFooter> : null}
      </DialogContent>
    </Dialog>
  </>;
}

function PaymentSummary({ payment, methods, canRecord, onRecorded }: { payment: Payment; methods: Array<{ id: string; name: string }>; canRecord: boolean; onRecorded: () => Promise<void> }) {
  const initialPaid = Boolean(payment.initialTransaction);
  const settled = Number(payment.outstandingAmount) <= 0;
  return <section className="flex flex-col gap-3" aria-label="Pembayaran invoice">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">Pembayaran</h3><Badge variant={settled ? "success" : "secondary"}>{settled ? "Lunas" : "Belum lunas"}</Badge></div>
    <PaymentRow label={payment.kind === "DP" ? "DP" : "Lunas"} amount={payment.initialAmount} status={initialPaid} method={payment.initialTransaction?.paymentMethod?.name} transaction={payment.initialTransaction} salesOrderId={payment.id} methods={methods} canRecord={canRecord} onRecorded={onRecorded} />
    {payment.terms.map((term) => <div key={term.id} className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">Termin {term.position + 1}</p><Badge variant={term.transaction ? "success" : "secondary"}>{term.transaction ? "Sudah dibayar" : "Belum dibayar"}</Badge></div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatCurrency(term.amount)} /><Info label="Jatuh tempo" value={formatDate(term.dueAt)} />{term.transaction ? <><Info label="Metode pembayaran" value={term.transaction.paymentMethod?.name ?? "-"} /><Info label="Dibayar pada" value={formatDate(term.transaction.paidAt, true)} /></> : null}</dl>
      {!term.transaction && canRecord ? <InvoiceTermPaymentForm salesOrderId={payment.id} termId={term.id} methods={methods} onRecorded={onRecorded} /> : null}
      {term.transaction && canRecord ? <PaymentTransactionControls transaction={term.transaction} salesOrderId={payment.id} methods={methods} onRecorded={onRecorded} /> : null}
    </div>)}
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Sisa pembayaran</span><strong className="font-mono tabular-nums">{formatCurrency(payment.outstandingAmount)}</strong></div>
  </section>;
}

function PaymentRow({ label, amount, status, method, transaction, salesOrderId, methods, canRecord, onRecorded }: { label: string; amount: string; status: boolean; method?: string; transaction: Payment["initialTransaction"]; salesOrderId: string; methods: Array<{ id: string; name: string }>; canRecord: boolean; onRecorded: () => Promise<void> }) {
  return <div className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{label}</p><Badge variant={status ? "success" : "secondary"}>{status ? "Sudah dibayar" : "Belum dibayar"}</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatCurrency(amount)} /><Info label="Metode pembayaran" value={method ?? "-"} /></dl>{transaction && canRecord ? <PaymentTransactionControls transaction={transaction} salesOrderId={salesOrderId} methods={methods} onRecorded={onRecorded} /> : null}</div>;
}

function InvoiceTermPaymentForm({ salesOrderId, termId, methods, onRecorded }: { salesOrderId: string; termId: string; methods: Array<{ id: string; name: string }>; onRecorded: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(payInvoicePaymentTermAction, { error: null, success: false });
  useEffect(() => { if (state.success) void onRecorded(); }, [onRecorded, state.success]);
  return <form action={formAction} className="mt-4 flex flex-col gap-3 border-t pt-3"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="paymentTermId" value={termId} />
    <Field><FieldLabel htmlFor={`invoice-term-method-${termId}`} required>Metode pembayaran</FieldLabel><NativeSelect id={`invoice-term-method-${termId}`} name="paymentMethodId" required defaultValue="" className="w-full"><NativeSelectOption value="" disabled>Pilih metode pembayaran</NativeSelectOption>{methods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}</NativeSelect></Field>
    {state.error ? <Alert variant="destructive"><AlertTitle>Pembayaran belum tercatat</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert> : null}
    <Button type="submit" className="self-start" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? "Mencatat..." : "Catat pembayaran"}</Button>
  </form>;
}

function PaymentTransactionControls({ transaction, salesOrderId, methods, onRecorded }: { transaction: NonNullable<Payment["initialTransaction"]>; salesOrderId: string; methods: Array<{ id: string; name: string }>; onRecorded: () => Promise<void> }) {
  const [editState, editAction, editing] = useActionState(editInvoicePaymentTransactionAction, { error: null, success: false });
  const [voidState, voidAction, voiding] = useActionState(voidInvoicePaymentTransactionAction, { error: null, success: false });
  useEffect(() => { if (editState.success || voidState.success) void onRecorded(); }, [editState.success, onRecorded, voidState.success]);
  return <div className="mt-4 flex flex-col gap-3 border-t pt-3"><details><summary className="w-fit cursor-pointer text-sm font-medium underline-offset-4 hover:underline">Koreksi pembayaran</summary><form action={editAction} className="mt-3 flex flex-col gap-3"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="transactionId" value={transaction.id} /><input type="hidden" name="version" value={transaction.version} /><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor={`amount-${transaction.id}`} required>Nominal</FieldLabel><Input id={`amount-${transaction.id}`} name="amount" type="number" min="0.01" step="0.01" required defaultValue={transaction.amount} /></Field><Field><FieldLabel htmlFor={`paid-at-${transaction.id}`} required>Waktu pembayaran</FieldLabel><Input id={`paid-at-${transaction.id}`} name="paidAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(transaction.paidAt)} /></Field><Field><FieldLabel htmlFor={`method-${transaction.id}`} required>Metode</FieldLabel><NativeSelect id={`method-${transaction.id}`} name="paymentMethodId" required defaultValue={transaction.paymentMethodId ?? ""} className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{methods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`reference-${transaction.id}`}>Referensi</FieldLabel><Input id={`reference-${transaction.id}`} name="reference" maxLength={120} defaultValue={transaction.reference ?? ""} /></Field></div><Field><FieldLabel htmlFor={`note-${transaction.id}`}>Catatan</FieldLabel><Textarea id={`note-${transaction.id}`} name="note" maxLength={1000} rows={2} defaultValue={transaction.note ?? ""} /></Field>{editState.error ? <Alert variant="destructive"><AlertDescription>{editState.error}</AlertDescription></Alert> : null}<Button type="submit" className="self-start" disabled={editing}>{editing ? "Menyimpan..." : "Simpan koreksi"}</Button></form></details><form action={voidAction} className="flex flex-col gap-2"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="transactionId" value={transaction.id} /><Textarea name="reason" required minLength={5} maxLength={1000} rows={2} placeholder="Alasan pembatalan pembayaran" />{voidState.error ? <Alert variant="destructive"><AlertDescription>{voidState.error}</AlertDescription></Alert> : null}<Button type="submit" variant="outline" className="self-start" disabled={voiding}>{voiding ? "Membatalkan..." : "Batalkan pembayaran"}</Button></form></div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-6"><dt className="text-muted-foreground">{label}</dt><dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd></div>; }
