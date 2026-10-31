"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";

import { editInvoicePaymentTransactionAction, payInvoicePaymentTermAction, payPendingInitialPaymentAction, updateInvoicePaymentDeadlinesAction, voidInvoicePaymentTransactionAction } from "@/app/actions/crm";
import { invoiceDetailAction } from "@/app/actions/crm-details";
import { DocumentDetailTrigger } from "@/components/crm/document-detail-trigger";
import { FilePicker } from "@/components/file-picker";
import { MoneyInput } from "@/components/money-input";
import { PaymentProofPreview } from "@/components/payment-proof-preview";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { InvoiceDeliveryActions } from "@/components/crm/invoice-delivery-actions";
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
import { formatInvoiceCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { numericCellClass } from "@/lib/table-alignment";

type Detail = Awaited<ReturnType<typeof invoiceDetailAction>>;
type Payment = NonNullable<NonNullable<Detail>["salesOrder"]>;
type PendingPayment = NonNullable<NonNullable<Detail>["pendingPayment"]>;
type InvoiceDeposit = NonNullable<NonNullable<Detail>["purchaseOrder"]["deposit"]>;

export function InvoiceDetail({ id, children, triggerClassName, triggerVariant }: { id: string; children: React.ReactNode; triggerClassName?: string; triggerVariant?: "preview" | "table-row" }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);

  // Identitas harus stabil: form pembayaran memanggil `onRecorded` dari useEffect, sehingga
  // fungsi yang dibuat ulang tiap render memicu pemuatan detail berulang tanpa henti.
  const loadDetail = useCallback(async () => {
    try {
      setDetail(await invoiceDetailAction(id));
      setError(false);
    } catch {
      setError(true);
    }
  }, [id]);

  // Catat pembayaran mengubah kolom status pada tabel CRM > Invoice, bukan hanya isi dialog.
  const reloadAfterMutation = useCallback(async () => {
    await loadDetail();
    startTransition(() => router.refresh());
  }, [loadDetail, router, startTransition]);

  function showDetail() {
    setOpen(true);
    if (!detail) void loadDetail();
  }

  // Kwitansi dibuat per pembayaran; tombolnya diletakkan di footer dialog (sebelum Lihat PDF).
  const receipts = detail?.salesOrder
    ? [
        ...(detail.salesOrder.initialTransaction ? [{ id: detail.salesOrder.initialTransaction.id, label: "Lihat Kwitansi" }] : []),
        ...detail.salesOrder.terms.flatMap((term) => (term.transaction ? [{ id: term.transaction.id, label: `Lihat Kwitansi Termin ${term.position + 1}` }] : [])),
      ]
    : [];
  // Add On baru berada di level invoice; dokumen lama masih menyimpannya per baris.
  const addons = detail ? [...detail.addons, ...detail.items.flatMap((item) => item.addons)] : [];

  return <>
    <DocumentDetailTrigger className={triggerClassName} onActivate={showDetail} variant={triggerVariant}>{children}</DocumentDetailTrigger>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>Detail invoice</DialogTitle><DialogDescription>Nilai tagihan, jadwal pembayaran, dan status pelunasan.</DialogDescription></DialogHeader>
        {!detail && !error ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Spinner /> Memuat detail...</div> : null}
        {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail invoice tidak dapat dimuat.</p> : null}
        {detail ? <div className="flex flex-col gap-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="No. Invoice" value={detail.invoiceNo} mono /><Info label="No. PO" value={detail.purchaseOrder.purchaseOrderNo} mono />
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><InvoiceStatusBadge status={detail.status} /></dd></div>
            <Info label="Customer" value={detail.snapshotCompanyName ?? detail.snapshotCustomerName} /><Info label="Tanggal dibuat" value={formatDate(detail.createdAt)} />
            {detail.pendingPayment || detail.salesOrder ? (() => {
              const deadline = detail.pendingPayment?.initialDueAt ?? detail.salesOrder?.initialDueAt ?? null;
              const deadlineText = deadline ? formatDate(deadline) : detail.dueAt ? `Ikut jatuh tempo (${formatDate(detail.dueAt)})` : "Belum diatur";
              return <Info label={`Deadline ${detail.pendingPayment?.kind ?? detail.salesOrder?.kind}`} value={deadlineText} />;
            })() : null}
          </dl>
          <Table className="min-w-[42rem] table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Diskon</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>
              {detail.items.map((item) => {
                const legacyAddonTotal = item.addons.reduce((sum, addon) => sum + Number(addon.unitAmount) * addon.qty, 0);
                return <TableRow key={item.id}><TableCell className="whitespace-normal font-medium">{item.productName ?? "-"}</TableCell><TableCell className="whitespace-normal">{item.description || "-"}</TableCell><TableCell className={numericCellClass(item.quantity, "text-right font-mono tabular-nums")}>{item.quantity}</TableCell><TableCell className={numericCellClass(item.unitPrice, "text-right tabular-nums")}>{formatInvoiceCurrency(item.unitPrice)}</TableCell><TableCell className={numericCellClass(discountCellText(item), "text-right tabular-nums")}>{discountCellText(item)}</TableCell><TableCell className={numericCellClass(Number(item.subtotal) - legacyAddonTotal, "text-right tabular-nums")}>{formatInvoiceCurrency(Number(item.subtotal) - legacyAddonTotal)}</TableCell></TableRow>;
              })}
              {addons.length ? <>
                <TableRow className="bg-info-surface hover:bg-info-surface">
                  <TableCell colSpan={6} className="border-t-2 border-info/20 px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">Add On</Badge>
                      <span className="text-xs text-info-surface-foreground">Item tambahan di luar produk</span>
                    </div>
                  </TableCell>
                </TableRow>
                {addons.map((addon, index) => <TableRow key={`${addon.label}-${index}`} className="bg-info-surface/40 hover:bg-info-surface/60"><TableCell className="whitespace-normal font-medium">{addon.label}</TableCell><TableCell className="whitespace-normal">{addon.description?.trim() || "-"}</TableCell><TableCell className={numericCellClass(addon.qty, "text-right font-mono tabular-nums")}>{addon.qty}</TableCell><TableCell className={numericCellClass(addon.unitAmount, "text-right tabular-nums")}>{formatInvoiceCurrency(addon.unitAmount)}</TableCell><TableCell className={numericCellClass(null, "text-right tabular-nums")}>-</TableCell><TableCell className={numericCellClass(Number(addon.unitAmount) * addon.qty, "text-right tabular-nums")}>{formatInvoiceCurrency(Number(addon.unitAmount) * addon.qty)}</TableCell></TableRow>)}
              </> : null}
            </TableBody>
          </Table>
          <dl className="ml-auto grid w-full gap-2 sm:max-w-xs"><Total label="Subtotal" value={formatInvoiceCurrency(detail.subtotal)} /><Total label="Diskon" value={formatInvoiceCurrency(detail.totalDiscount ?? "0")} />{Number(detail.taxPercent) ? <Total label={`Pajak (${Number(detail.taxPercent)}%)`} value={formatInvoiceCurrency(detail.taxAmount ?? "0")} /> : null}<Total label="Deposit" value={formatInvoiceCurrency(detail.purchaseOrder.depositAmount ?? "0")} /><Total label="Total" value={formatInvoiceCurrency(detail.total)} strong /></dl>
          {detail.salesOrder ? <PaymentSummary payment={detail.salesOrder} deposit={detail.purchaseOrder.deposit} invoiceId={detail.id} purchaseOrderId={detail.purchaseOrderId} initialDueAt={detail.salesOrder.initialDueAt} methods={detail.paymentMethods} canRecord={detail.canRecordPayment} onRecorded={reloadAfterMutation} /> : null}
          {!detail.salesOrder && detail.pendingPayment ? <PendingPaymentSummary invoiceId={detail.id} payment={detail.pendingPayment} methods={detail.paymentMethods} canRecord={detail.canRecordPayment && detail.status === "ISSUED"} issued={detail.status === "ISSUED"} productionDeadline={detail.purchaseOrder.deadline} onRecorded={reloadAfterMutation} /> : null}
          {!detail.salesOrder && !detail.pendingPayment ? <section className="rounded-lg border bg-muted/30 p-3 text-sm" aria-label="Status jadwal pembayaran"><Badge variant="secondary">Jadwal pembayaran belum diatur</Badge><p className="mt-2 text-muted-foreground">Atur jadwal pembayaran (DP/Lunas) dari tab Invoice sebelum invoice diterbitkan; tgl. jatuh tempo dan deadline diisi manual pada form draft.</p></section> : null}
          {detail.notes ? <Info label="Catatan" value={detail.notes} /> : null}
        </div> : null}
        {detail ? <DialogFooter>{detail.status === "ISSUED" ? <InvoiceDeliveryActions invoiceId={detail.id} invoiceNo={detail.invoiceNo} receipts={receipts} /> : null}<Button nativeButton={false} render={<Link href={`/crm/peluang/${detail.opportunity.id}?tab=invoice`} />}>Kelola Invoice</Button></DialogFooter> : null}
      </DialogContent>
    </Dialog>
  </>;
}

function paymentKindLabel(kind: string) {
  return kind === "DP" ? "DP" : kind === "DEPOSIT" ? "Deposit" : kind === "LUNAS" ? "Lunas" : kind;
}

/** Satu hari penuh yang sudah lewat (pola yang sama dengan peringatan deadline di bawah). */
function isOverdue(dueAt: Date | string | null | undefined, unpaid: boolean) {
  if (!dueAt || !unpaid) return false;
  return new Date(dueAt).getTime() < new Date(new Date().toDateString()).getTime();
}

/** Teks kolom diskon menyesuaikan tipe (R6): nominal ⇄ persen. */
function discountCellText(item: { discountType?: string; discountPercent?: string | { toString(): string }; discountAmount?: string | { toString(): string } }) {
  const pct = Number(item.discountPercent ?? 0);
  const amount = Number(item.discountAmount ?? 0);
  const nominal = formatInvoiceCurrency(item.discountAmount ?? "0");
  if (item.discountType === "NOMINAL") return amount > 0 ? `${nominal} (${pct}%)` : "-";
  return pct > 0 ? `${pct}% (${nominal})` : "-";
}

/** Baris termin/DP yang terlambat diwarnai merah utuh: border + latar + teks deadline. */
const overdueRowClass = "border-destructive bg-destructive/10";

function PaymentSummary({ payment, deposit, invoiceId, purchaseOrderId, initialDueAt, methods, canRecord, onRecorded }: { payment: Payment; deposit: InvoiceDeposit | null; invoiceId: string; purchaseOrderId: string; initialDueAt: Date | null; methods: Array<{ id: string; name: string }>; canRecord: boolean; onRecorded: () => Promise<void> }) {
  const initialPaid = Boolean(payment.initialTransaction);
  // DP Rp 0: tidak ada pembayaran awal yang perlu dicatat — baris netral, tanpa peringatan telat (R7).
  const initialZero = !initialPaid && payment.kind === "DP" && Number(payment.initialAmount) === 0;
  const settled = Number(payment.outstandingAmount) <= 0;
  const statusLabel = settled ? "Lunas" : initialPaid ? paymentKindLabel(payment.kind) : "Belum Terbayar";
  const initialOverdue = isOverdue(initialDueAt, !initialPaid && !initialZero);
  return <section className="flex flex-col gap-3" aria-label="Pembayaran invoice">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-medium">Pembayaran</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={settled ? "success" : "secondary"}>{statusLabel}</Badge>
        {canRecord ? <DeadlineEditButton invoiceId={invoiceId} label={paymentKindLabel(payment.kind)} initialDueAt={payment.initialDueAt} terms={payment.terms} onSaved={onRecorded} /> : null}
      </div>
    </div>
    {deposit ? <DepositRow deposit={deposit} purchaseOrderId={purchaseOrderId} /> : null}
    <PaymentRow label={paymentKindLabel(payment.kind)} amount={payment.initialAmount} status={initialPaid} overdue={initialOverdue} neutral={initialZero ? "Tidak ada DP" : undefined} method={payment.initialTransaction?.paymentMethod?.name} transaction={payment.initialTransaction} salesOrderId={payment.id} methods={methods} canRecord={canRecord} onRecorded={onRecorded} />
    {payment.terms.map((term) => {
      const overdue = isOverdue(term.dueAt, !term.transaction);
      return <div key={term.id} className={`rounded-lg border p-3 text-sm${overdue ? ` ${overdueRowClass}` : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className={`font-medium${overdue ? " text-destructive" : ""}`}>Termin {term.position + 1}</p><Badge variant={term.transaction ? "success" : overdue ? "destructive" : "secondary"}>{term.transaction ? "Sudah dibayar" : overdue ? "Terlambat" : "Belum dibayar"}</Badge></div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatInvoiceCurrency(term.amount)} /><Info label={`Deadline Termin ${term.position + 1}`} value={formatDate(term.dueAt)} tone={overdue ? "destructive" : undefined} />{term.transaction ? <><Info label="Metode pembayaran" value={term.transaction.paymentMethod?.name ?? "-"} /><Info label="Dibayar pada" value={formatDate(term.transaction.paidAt, true)} /><Proof transaction={term.transaction} /></> : null}</dl>
        {!term.transaction && canRecord ? <InvoiceTermPaymentForm salesOrderId={payment.id} termId={term.id} methods={methods} onRecorded={onRecorded} /> : null}
        {term.transaction && canRecord ? <PaymentTransactionControls transaction={term.transaction} salesOrderId={payment.id} methods={methods} onRecorded={onRecorded} /> : null}
      </div>;
    })}
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Sisa pembayaran</span><strong className="font-mono tabular-nums">{formatInvoiceCurrency(payment.outstandingAmount)}</strong></div>
  </section>;
}

function PendingPaymentSummary({ invoiceId, payment, methods, canRecord, issued, productionDeadline, onRecorded }: { invoiceId: string; payment: PendingPayment; methods: Array<{ id: string; name: string }>; canRecord: boolean; issued: boolean; productionDeadline: Date | null; onRecorded: () => Promise<void> }) {
  // Deadline opsional: tanpa tanggal = tanpa batas, tanpa peringatan terlambat; draft belum menagih.
  const overdue = issued && isOverdue(payment.initialDueAt, true);
  const label = paymentKindLabel(payment.kind);
  return <section className="flex flex-col gap-3" aria-label="Jadwal pembayaran invoice">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-medium">Jadwal pembayaran</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{issued ? `Menunggu ${label}` : "Jadwal tersimpan"}</Badge>
        {canRecord ? <DeadlineEditButton invoiceId={invoiceId} label={label} initialDueAt={payment.initialDueAt} terms={payment.terms} onSaved={onRecorded} /> : null}
      </div>
    </div>
    {overdue ? <Alert variant="destructive"><AlertTitle>Deadline {label} terlewat</AlertTitle><AlertDescription>Belum ada pembayaran awal. Admin dapat menindaklanjuti atau menandai peluang Lost secara manual.</AlertDescription></Alert> : null}
    <div className={`rounded-lg border p-3 text-sm${overdue ? ` ${overdueRowClass}` : ""}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className={`font-medium${overdue ? " text-destructive" : ""}`}>{label}</p><Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? "Terlambat" : "Belum dibayar"}</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatInvoiceCurrency(payment.initialAmount)} /><Info label={`Deadline ${label}`} value={payment.initialDueAt ? formatDate(payment.initialDueAt) : "Belum diatur"} tone={overdue ? "destructive" : undefined} /></dl>{canRecord ? <PendingInitialPaymentForm invoiceId={invoiceId} label={label} methods={methods} onRecorded={onRecorded} /> : null}</div>
    {payment.terms.map((term) => {
      const termOverdue = issued && isOverdue(term.dueAt, true);
      return <div key={term.id} className={`rounded-lg border p-3 text-sm${termOverdue ? ` ${overdueRowClass}` : ""}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className={`font-medium${termOverdue ? " text-destructive" : ""}`}>Termin {term.position + 1}</p><Badge variant={termOverdue ? "destructive" : "secondary"}>{termOverdue ? "Terlambat" : "Belum dibayar"}</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatInvoiceCurrency(term.amount)} /><Info label={`Deadline Termin ${term.position + 1}`} value={formatDate(term.dueAt)} tone={termOverdue ? "destructive" : undefined} /><Info label="Metode pembayaran" value="Dipilih saat pembayaran" /></dl>{productionDeadline && term.dueAt && term.dueAt > productionDeadline ? <p className="mt-3 text-xs text-muted-foreground">Melewati Deadline Produksi {formatDate(productionDeadline)}; produksi tetap berjalan setelah DP dan pengiriman menunggu lunas.</p> : null}</div>;
    })}
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Sisa pembayaran</span><strong className="font-mono tabular-nums">{formatInvoiceCurrency(payment.terms.reduce((sum, term) => sum + Number(term.amount), 0) + Number(payment.initialAmount))}</strong></div>
  </section>;
}

function jakartaMaxDateTimeLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function PendingInitialPaymentForm({ invoiceId, label, methods, onRecorded }: { invoiceId: string; label: string; methods: Array<{ id: string; name: string }>; onRecorded: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(payPendingInitialPaymentAction, { error: null, success: false });
  useEffect(() => { if (state.success) void onRecorded(); }, [onRecorded, state.success]);
  return <form action={formAction} className="mt-4 flex flex-col gap-3 border-t pt-3"><input type="hidden" name="invoiceId" value={invoiceId} /><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="pending-payment-method" required>Metode pembayaran</FieldLabel><NativeSelect id="pending-payment-method" name="paymentMethodId" required defaultValue="" className="w-full"><NativeSelectOption value="" disabled>Pilih metode pembayaran</NativeSelectOption>{methods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="pending-paid-at">Tanggal bayar</FieldLabel><Input id="pending-paid-at" name="paidAt" type="datetime-local" max={jakartaMaxDateTimeLocal()} /></Field></div><Field><FieldLabel>Bukti pembayaran</FieldLabel><FilePicker suppliedId="pending-payment-proof" /><p className="text-xs text-muted-foreground">Wajib untuk QRIS atau Bank.</p></Field>{state.error ? <Alert variant="destructive"><AlertTitle>Pembayaran belum tercatat</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert> : null}    <Button type="submit" className="self-start" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? "Mencatat..." : `Catat pembayaran ${label}`}</Button></form>;
}

/** Ubah deadline (tanggal saja) setelah invoice terbit — nominal jadwal tetap terkunci. */
function DeadlineEditButton({ invoiceId, label, initialDueAt, terms, onSaved }: { invoiceId: string; label: string; initialDueAt: Date | null; terms: Array<{ id: string; position: number; dueAt: Date | null }>; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  // Dialog dibuka sebagai child terpisah: state useActionState di-reset saat ditutup (unmount).
  const close = useCallback(() => setOpen(false), []);
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Ubah deadline</Button>
    {open ? <DeadlineEditDialog invoiceId={invoiceId} label={label} initialDueAt={initialDueAt} terms={terms} onSaved={onSaved} onClose={close} /> : null}
  </>;
}

function DeadlineEditDialog({ invoiceId, label, initialDueAt, terms, onSaved, onClose }: { invoiceId: string; label: string; initialDueAt: Date | null; terms: Array<{ id: string; position: number; dueAt: Date | null }>; onSaved: () => Promise<void>; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateInvoicePaymentDeadlinesAction, { error: null, success: false });
  useEffect(() => { if (state.success) { onClose(); void onSaved(); } }, [onClose, onSaved, state.success]);
  const dateValue = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
  return <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Ubah deadline pembayaran</DialogTitle><DialogDescription>Hanya tanggal yang diubah; nominal jadwal tetap. Kosongkan tanggal untuk tanpa batas.</DialogDescription></DialogHeader>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Field><FieldLabel htmlFor={`deadline-initial-${invoiceId}`}>Deadline {label}</FieldLabel><Input id={`deadline-initial-${invoiceId}`} name="initialDueAt" type="date" defaultValue={dateValue(initialDueAt)} /></Field>
        {terms.map((term) => (
          <Field key={term.id}><FieldLabel htmlFor={`deadline-term-${term.id}`}>Deadline Termin {term.position + 1}</FieldLabel><Input id={`deadline-term-${term.id}`} name="termDueAt" type="date" defaultValue={dateValue(term.dueAt)} /></Field>
        ))}
        {state.error ? <Alert variant="destructive"><AlertTitle>Deadline belum diubah</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? "Menyimpan..." : "Simpan deadline"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function PaymentRow({ label, amount, status, overdue = false, neutral, method, transaction, salesOrderId, methods, canRecord, onRecorded }: { label: string; amount: string; status: boolean; overdue?: boolean; neutral?: string; method?: string; transaction: Payment["initialTransaction"]; salesOrderId: string; methods: Array<{ id: string; name: string }>; canRecord: boolean; onRecorded: () => Promise<void> }) {
  return <div className={`rounded-lg border p-3 text-sm${overdue ? ` ${overdueRowClass}` : ""}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className={`font-medium${overdue ? " text-destructive" : ""}`}>{label}</p><Badge variant={neutral ? "secondary" : status ? "success" : overdue ? "destructive" : "secondary"}>{neutral ?? (status ? "Sudah dibayar" : overdue ? "Terlambat" : "Belum dibayar")}</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatInvoiceCurrency(amount)} /><Info label="Metode pembayaran" value={method ?? "-"} />{transaction ? <Proof transaction={transaction} /> : null}</dl>{transaction && canRecord ? <PaymentTransactionControls transaction={transaction} salesOrderId={salesOrderId} methods={methods} onRecorded={onRecorded} /> : null}</div>;
}

/** Baris Deposit: uang sudah diterima lewat PO, tampilan hanya-baca (bukti tetap milik PO). */
function DepositRow({ deposit, purchaseOrderId }: { deposit: InvoiceDeposit; purchaseOrderId: string }) {
  return <div className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">Deposit</p><Badge variant="success">Sudah dibayar</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Nominal" value={formatInvoiceCurrency(deposit.amount)} /><Info label="Metode pembayaran" value={deposit.paymentMethod?.name ?? "-"} /><Info label="Dibayar pada" value={formatDate(deposit.paidAt, true)} />{deposit.note ? <Info label="Catatan" value={deposit.note} /> : null}{deposit.proofFileName ? <div><dt className="text-xs text-muted-foreground">Bukti pembayaran</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><PaymentProofPreview href={`/api/crm/purchase-order/${purchaseOrderId}/deposit/proof`} mimeType={deposit.proofMimeType} label="Bukti deposit" /><span className="min-w-0 truncate text-xs text-muted-foreground">{deposit.proofFileName}</span></dd></div> : null}</dl></div>;
}

function InvoiceTermPaymentForm({ salesOrderId, termId, methods, onRecorded }: { salesOrderId: string; termId: string; methods: Array<{ id: string; name: string }>; onRecorded: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(payInvoicePaymentTermAction, { error: null, success: false });
  useEffect(() => { if (state.success) void onRecorded(); }, [onRecorded, state.success]);
  return <form action={formAction} className="mt-4 flex flex-col gap-3 border-t pt-3"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="paymentTermId" value={termId} />
    <div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor={`invoice-term-method-${termId}`} required>Metode pembayaran</FieldLabel><NativeSelect id={`invoice-term-method-${termId}`} name="paymentMethodId" required defaultValue="" className="w-full"><NativeSelectOption value="" disabled>Pilih metode pembayaran</NativeSelectOption>{methods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`invoice-term-paid-${termId}`}>Tanggal bayar</FieldLabel><Input id={`invoice-term-paid-${termId}`} name="paidAt" type="datetime-local" max={jakartaMaxDateTimeLocal()} /></Field></div>
    <Field><FieldLabel>Bukti pembayaran</FieldLabel><FilePicker suppliedId={`invoice-term-proof-${termId}`} /><p className="text-xs text-muted-foreground">Wajib untuk QRIS atau Bank.</p></Field>{state.error ? <Alert variant="destructive"><AlertTitle>Pembayaran belum tercatat</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert> : null}
    <Button type="submit" className="self-start" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? "Mencatat..." : "Catat pembayaran"}</Button>
  </form>;
}

function PaymentTransactionControls({ transaction, salesOrderId, methods, onRecorded }: { transaction: NonNullable<Payment["initialTransaction"]>; salesOrderId: string; methods: Array<{ id: string; name: string }>; onRecorded: () => Promise<void> }) {
  const [editState, editAction, editing] = useActionState(editInvoicePaymentTransactionAction, { error: null, success: false });
  const [voidState, voidAction, voiding] = useActionState(voidInvoicePaymentTransactionAction, { error: null, success: false });
  useEffect(() => { if (editState.success || voidState.success) void onRecorded(); }, [editState.success, onRecorded, voidState.success]);
  return <div className="mt-4 flex flex-col gap-3 border-t pt-3"><details><summary className="w-fit cursor-pointer text-sm font-medium underline-offset-4 hover:underline">Koreksi pembayaran</summary><form action={editAction} className="mt-3 flex flex-col gap-3"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="transactionId" value={transaction.id} /><input type="hidden" name="version" value={transaction.version} /><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor={`amount-${transaction.id}`} required>Nominal</FieldLabel><MoneyInput id={`amount-${transaction.id}`} name="amount" min="0.01" step="0.01" required defaultValue={transaction.amount} /></Field><Field><FieldLabel htmlFor={`paid-at-${transaction.id}`} required>Tanggal bayar</FieldLabel><Input id={`paid-at-${transaction.id}`} name="paidAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(transaction.paidAt)} max={jakartaMaxDateTimeLocal()} /></Field><Field><FieldLabel htmlFor={`method-${transaction.id}`} required>Metode</FieldLabel><NativeSelect id={`method-${transaction.id}`} name="paymentMethodId" required defaultValue={transaction.paymentMethodId ?? ""} className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{methods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`reference-${transaction.id}`}>Referensi</FieldLabel><Input id={`reference-${transaction.id}`} name="reference" maxLength={120} defaultValue={transaction.reference ?? ""} /></Field></div><Field><FieldLabel htmlFor={`note-${transaction.id}`}>Catatan</FieldLabel><Textarea id={`note-${transaction.id}`} name="note" maxLength={1000} rows={2} defaultValue={transaction.note ?? ""} /></Field><Field><FieldLabel>Bukti pembayaran baru</FieldLabel><FilePicker suppliedId={`payment-proof-${transaction.id}`} /><p className="text-xs text-muted-foreground">Kosongkan untuk mempertahankan bukti lama.</p></Field>{editState.error ? <Alert variant="destructive"><AlertDescription>{editState.error}</AlertDescription></Alert> : null}<Button type="submit" className="self-start" disabled={editing}>{editing ? "Menyimpan..." : "Simpan koreksi"}</Button></form></details><form action={voidAction} className="flex flex-col gap-2"><input type="hidden" name="salesOrderId" value={salesOrderId} /><input type="hidden" name="transactionId" value={transaction.id} /><Textarea name="reason" required minLength={5} maxLength={1000} rows={2} placeholder="Alasan pembatalan pembayaran" />{voidState.error ? <Alert variant="destructive"><AlertDescription>{voidState.error}</AlertDescription></Alert> : null}<Button type="submit" variant="outline" className="self-start" disabled={voiding}>{voiding ? "Membatalkan..." : "Batalkan pembayaran"}</Button></form></div>;
}

function Proof({ transaction }: { transaction: NonNullable<Payment["initialTransaction"]> }) { return <div><dt className="text-xs text-muted-foreground">Bukti pembayaran</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><PaymentProofPreview href={transaction.proofPath ? `/api/crm/payment-transactions/${transaction.id}/proof` : null} mimeType={transaction.proofMimeType} label="Bukti pembayaran invoice" /></dd></div>; }
function Info({ label, value, mono = false, tone }: { label: string; value: string; mono?: boolean; tone?: "destructive" }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 font-mono" : `mt-1 whitespace-pre-wrap${tone === "destructive" ? " font-medium text-destructive" : ""}`}>{value}</dd></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-6"><dt className="text-muted-foreground">{label}</dt><dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd></div>; }
