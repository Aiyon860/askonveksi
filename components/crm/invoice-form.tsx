"use client";

import { useActionState, useState, type KeyboardEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { createInvoiceDraftAction, createInvoiceRevisionAction } from "@/app/actions/crm";
import { MoneyInput } from "@/components/money-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { initialFormActionState } from "@/lib/actions/form-state";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/crm/format";
import { groupPurchaseOrderInvoiceItems } from "@/lib/crm/invoice-grouping";
import { cn } from "@/lib/utils";

const MAX_ADDONS = 20;
type DiscountMode = "NOMINAL" | "PERCENTAGE";

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  productName: string;
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  items?: Array<{ id: string; name: string; garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null }>;
  sizes: Array<{ id: string; itemId?: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  /** Deposit desain yang sudah dibayar pada PO; mengurangi sisa yang perlu dijadwalkan. */
  depositAmount?: string | null;
};

type DraftAddon = { label?: string; description?: string; amount?: string; qty?: number };

type DraftItem = {
  productName?: string;
  description?: string;
  size?: string;
  sleeveLength?: "PENDEK" | "PANJANG" | null;
  quantity?: number;
  unitPrice: string;
  discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountPercent?: string;
  discountNominal?: string;
};

type DraftScheduleTerm = { value: string; dueAt: string };
type DraftSchedule = {
  kind: string;
  initialValueType: "NOMINAL" | "PERCENTAGE";
  initialValue: string;
  initialDueAt: string;
  terms: DraftScheduleTerm[];
};

type InvoiceFormValues = {
  notes: string;
  /** Jatuh tempo diisi manual; dikirim bersama draft (wajib di server). */
  dueAt?: string;
  /** Prefill jadwal tersimpan; opsional saat simpan, wajib sebelum terbit. */
  schedule?: DraftSchedule;
  discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountPercent: string;
  discountNominal?: string;
  taxPercent?: string;
  /** Add On invoice (baru) hasil migrasi dari Add On per baris draft lama. */
  addons?: DraftAddon[];
  items: DraftItem[];
};

type AddonDraft = { key: string; label: string; description: string; amount: string; qty: string };
type RowPricing = { unitPrice: string; discountType: DiscountMode; discountPercent: string; discountNominal: string };

function toMode(value: string | undefined): DiscountMode {
  return value === "NOMINAL" ? "NOMINAL" : "PERCENTAGE";
}

function rowGross(row: RowPricing, quantity: number) {
  return (Number(row.unitPrice) || 0) * quantity;
}

function addonGross(addons: AddonDraft[]) {
  return addons.reduce((sum, addon) => sum + (Number(addon.amount) || 0) * (Number(addon.qty) || 1), 0);
}

/** Qty hanya menerima ketikan angka; panah naik/turun tidak lagi mengubah nilai. */
function preventNonIntegerQtyKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+", "-", ".", ",", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
  }
}

/** Kosongkan angka 0 agar kolom diskon/pajak mulai dari placeholder, bukan "0" yang harus dihapus dulu. */
function initNumber(value: string | undefined) {
  const text = (value ?? "").trim();
  return text === "" || text === "0" ? "" : text;
}

/** Bulatkan ke kelipatan Rp500 terdekat, setengah ke bawah — mirror `roundInvoiceTotal` (server). */
function roundPaymentAmount(value: number) {
  const scaled = value / 500;
  const lower = Math.floor(scaled);
  return (scaled - lower > 0.5 ? lower + 1 : lower) * 500;
}

/** Tanggal +N hari pada kalender Asia/Jakarta (string YYYY-MM-DD). */
function addJakartaDays(value: string, days: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day") + days)).toISOString().slice(0, 10);
}

/** Pembulatan 2 desimal seperti `toDecimalPlaces(2)` (HALF_UP) untuk pratinjau klien. */
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

type TermDraft = { key: string; value: string; dueAt: string };

/** Pratinjau turunan: nominal ⇄ persen, dihitung dari produk setelah diskon baris + Add On. */
function derivedDiscount(gross: number, type: DiscountMode, percent: string, nominal: string) {
  const pct = Number(percent) || 0;
  const nom = Number(nominal) || 0;
  if (gross <= 0) return null;
  if (type === "NOMINAL") return nom > 0 ? `≈ ${(nom / gross * 100).toFixed(2)}%` : null;
  return pct > 0 ? `– ${formatCurrency(gross * pct / 100)}` : null;
}

/** Toggle Rp/% di ujung kanan kotak diskon. Nilai mentah tetap satu kolom: tekan untuk ganti satuan. */
function DiscountToggle({ type, onChange, label }: { type: DiscountMode; onChange: (mode: DiscountMode) => void; label: string }) {
  return (
    <InputGroupAddon align="inline-end" className="self-stretch p-0">
      <div className="flex h-full items-stretch divide-x divide-input border-l border-input">
        {([["PERCENTAGE", "%"], ["NOMINAL", "Rp"]] as const).map(([mode, text]) => (
          <InputGroupButton
            key={mode}
            type="button"
            variant={type === mode ? "secondary" : "ghost"}
            size="xs"
            className={cn("h-full rounded-none px-2.5 text-xs", type === mode && "font-semibold text-foreground")}
            aria-pressed={type === mode}
            aria-label={`${label} dalam ${mode === "PERCENTAGE" ? "persen" : "rupiah"}`}
            onClick={() => onChange(mode)}
          >
            {text}
          </InputGroupButton>
        ))}
      </div>
    </InputGroupAddon>
  );
}

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
  const groups = groupPurchaseOrderInvoiceItems(purchaseOrder);
  const normalizeName = (value: string | undefined) => (value ?? "").trim().toLocaleLowerCase("id-ID");
  const savedByProduct = new Map<string, DraftItem[]>();
  for (const item of values?.items ?? []) {
    const key = normalizeName(item.productName);
    savedByProduct.set(key, [...(savedByProduct.get(key) ?? []), item]);
  }

  /**
   * Draft baru selalu satu baris per produk. Untuk revisi draft lama yang masih
   * punya baris per ukuran, harga awal memakai rata-rata tertimbang qty agar
   * total lama tidak melompat sebelum admin menyesuaikan.
   */
  function initialPricingFor(group: { productName: string }): RowPricing {
    const saved = savedByProduct.get(normalizeName(group.productName)) ?? [];
    if (!saved.length) return { unitPrice: "", discountType: "PERCENTAGE", discountPercent: "", discountNominal: "" };
    const first = saved[0];
    const savedQuantity = saved.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const savedBase = saved.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (item.quantity ?? 0), 0);
    const unitPrice = saved.length === 1
      ? first.unitPrice
      : savedQuantity > 0
        ? String(round2(savedBase / savedQuantity))
        : first.unitPrice;
    const allNominal = saved.every((item) => item.discountType === "NOMINAL");
    const nominalTotal = saved.reduce((sum, item) => sum + (Number(item.discountNominal) || 0), 0);
    return {
      unitPrice,
      discountType: toMode(first.discountType),
      discountPercent: first.discountType === "NOMINAL" ? "" : initNumber(first.discountPercent),
      discountNominal: allNominal ? initNumber(String(round2(nominalTotal))) : first.discountType === "NOMINAL" ? initNumber(first.discountNominal) : "",
    };
  }

  const [orderDiscountType, setOrderDiscountType] = useState<DiscountMode>(() => toMode(values?.discountType));
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(() => values?.discountType === "NOMINAL" ? "" : initNumber(values?.discountPercent));
  const [orderDiscountNominal, setOrderDiscountNominal] = useState(() => values?.discountType === "NOMINAL" ? initNumber(values?.discountNominal) : "");
  const [taxPercent, setTaxPercent] = useState(() => initNumber(values?.taxPercent));

  const [rows, setRows] = useState<RowPricing[]>(() => groups.map(initialPricingFor));
  const [addons, setAddons] = useState<AddonDraft[]>(() => (values?.addons ?? []).slice(0, MAX_ADDONS).map((addon, index) => ({
    key: `saved-addon-${index}`,
    label: addon.label ?? "",
    description: addon.description ?? "",
    amount: addon.amount ?? "",
    qty: String(addon.qty ?? 1),
  })));

  const prefillSchedule = values?.schedule;
  const [dueAt, setDueAt] = useState(() => values?.dueAt ?? "");
  const [scheduleKind, setScheduleKind] = useState(() => prefillSchedule?.kind ?? "");
  // Data lama bisa berbasis persen; input DP baru memakai nominal kecuali prefill persen.
  const [initialValueType, setInitialValueType] = useState<"NOMINAL" | "PERCENTAGE">(() => (prefillSchedule && prefillSchedule.kind !== "LUNAS" ? prefillSchedule.initialValueType : "NOMINAL"));
  const [initialValue, setInitialValue] = useState(() => (prefillSchedule && prefillSchedule.kind !== "LUNAS" ? prefillSchedule.initialValue : ""));
  const [initialDueAt, setInitialDueAt] = useState(() => (prefillSchedule && prefillSchedule.kind !== "LUNAS" ? prefillSchedule.initialDueAt : ""));
  const [scheduleTerms, setScheduleTerms] = useState<TermDraft[]>(() => {
    const saved = prefillSchedule && prefillSchedule.kind !== "LUNAS" ? prefillSchedule.terms : [];
    return saved.length
      ? saved.map((term, index) => ({ key: `term-${index}`, value: term.value, dueAt: term.dueAt }))
      : [{ key: "term-0", value: "", dueAt: "" }];
  });

  // Dasar diskon total = produk setelah diskon per baris + seluruh Add On.
  const productNet = groups.reduce((sum, group, index) => {
    const row = rows[index];
    const gross = round2((Number(row.unitPrice) || 0) * group.quantity);
    const pct = Math.min(100, Math.max(0, Number(row.discountPercent) || 0));
    const nom = Math.max(0, Number(row.discountNominal) || 0);
    const discount = row.discountType === "NOMINAL" ? Math.min(nom, gross) : round2(gross * pct / 100);
    return sum + gross - discount;
  }, 0);
  const orderDiscountBase = round2(productNet + addonGross(addons));
  const orderDerived = derivedDiscount(orderDiscountBase, orderDiscountType, orderDiscountPercent, orderDiscountNominal);

  const depositAmountNumber = Number(purchaseOrder.depositAmount ?? 0) || 0;
  // Pratinjau total klien: mirror calculateInvoiceLines — produk + Add On, diskon per baris → diskon total → pajak → bulat Rp500.
  const previewTotal = (() => {
    const orderPct = Math.min(100, Math.max(0, Number(orderDiscountPercent) || 0));
    const orderNom = Math.max(0, Number(orderDiscountNominal) || 0);
    const orderDiscount = orderDiscountType === "NOMINAL" ? Math.min(orderNom, Math.max(0, orderDiscountBase)) : round2(orderDiscountBase * orderPct / 100);
    const afterDiscount = Math.max(0, orderDiscountBase - orderDiscount);
    const taxAmount = round2(afterDiscount * (Number(taxPercent) || 0) / 100);
    return roundPaymentAmount(afterDiscount + taxAmount);
  })();

  const scheduleActive = scheduleKind !== "";
  const collectibleAmount = Math.max(0, previewTotal - depositAmountNumber);
  // Mirror buildPaymentSchedule: Lunas (kind LUNAS, persen 100, atau nominal yang menutup sisa) tanpa termin.
  const effectiveLunas =
    scheduleKind === "LUNAS" ||
    (initialValueType === "PERCENTAGE" && Number(initialValue) === 100) ||
    (scheduleKind !== "" && scheduleKind !== "LUNAS" && initialValueType === "NOMINAL" && collectibleAmount > 0 && (Number(initialValue) || 0) >= collectibleAmount);
  const initialAmount = !scheduleActive
    ? 0
    : effectiveLunas
      ? collectibleAmount
      : initialValueType === "PERCENTAGE"
        ? roundPaymentAmount(collectibleAmount * (Number(initialValue) || 0) / 100)
        : Number(initialValue) || 0;
  const outstandingAmount = Math.max(0, collectibleAmount - initialAmount);
  const scheduledTermAmount = scheduleTerms.reduce((sum, term) => sum + (Number(term.value) || 0), 0);
  const scheduleDifference = outstandingAmount - scheduledTermAmount;
  const scheduleBaseline = initialDueAt || dueAt;
  function previousFilledDueAt(index: number) {
    for (let position = index - 1; position >= 0; position -= 1) {
      if (scheduleTerms[position].dueAt) return scheduleTerms[position].dueAt;
    }
    return undefined;
  }
  // Deadline termin opsional; yang terisi wajib berurutan +1 hari dari baseline/termin terisi sebelumnya.
  const datesReady = scheduleTerms.every((term, index) => {
    if (!term.dueAt) return true;
    const previous = previousFilledDueAt(index) || scheduleBaseline;
    return !previous || term.dueAt >= addJakartaDays(previous, 1);
  });
  const scheduleReady = !scheduleActive
    || (collectibleAmount <= 0
      ? false
      : effectiveLunas || (Math.abs(scheduleDifference) < 0.005 && datesReady));
  const deadlineBaselineLabel = initialDueAt ? `deadline DP (${initialDueAt})` : dueAt ? `jatuh tempo (${dueAt})` : "jatuh tempo";

  function updateRow(index: number, patch: Partial<RowPricing>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function updateAddon(addonKey: string, patch: Partial<AddonDraft>) {
    setAddons((current) => current.map((addon) => (addon.key === addonKey ? { ...addon, ...patch } : addon)));
  }
  function addAddon() {
    setAddons((current) => current.length >= MAX_ADDONS
      ? current
      : [...current, { key: `new-addon-${Date.now()}-${current.length}`, label: "", description: "", amount: "", qty: "1" }]);
  }
  function removeAddon(addonKey: string) {
    setAddons((current) => current.filter((addon) => addon.key !== addonKey));
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
      {sourceInvoiceId ? <input type="hidden" name="sourceInvoiceId" value={sourceInvoiceId} /> : null}
      <FieldGroup>
        <Table containerClassName="rounded-lg border">
          <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Deskripsi</TableHead><TableHead className="w-16 text-center">Qty</TableHead><TableHead className="min-w-36">Harga</TableHead><TableHead className="min-w-40">Diskon</TableHead></TableRow></TableHeader>
          <TableBody>
            {groups.map((group, rowIndex) => {
              const saved = savedByProduct.get(normalizeName(group.productName))?.[0];
              const rowName = saved?.productName?.trim() || group.productName;
              const row = rows[rowIndex];
              const gross = rowGross(row, group.quantity);
              const derived = derivedDiscount(gross, row.discountType, row.discountPercent, row.discountNominal);
              return (
                <TableRow key={group.key}>
                  <TableCell className="min-w-40 align-top">
                    <Input name="itemProductName" required minLength={2} maxLength={120} defaultValue={rowName} aria-label={`Produk ${rowName}`} />
                    <input type="hidden" name="itemPurchaseOrderItemId" value={group.purchaseOrderItemId} />
                  </TableCell>
                  <TableCell className="min-w-56 align-top"><Textarea name="itemDescription" maxLength={240} rows={1} defaultValue={saved?.description ?? ""} placeholder="Deskripsi opsional..." aria-label={`Deskripsi ${rowName}`} className="min-h-9 resize-y" /></TableCell>
                  <TableCell className="w-16 align-top"><div className="flex h-9 items-center justify-center font-mono tabular-nums">{group.quantity}</div></TableCell>
                  <TableCell className="align-top"><MoneyInput name="itemUnitPrice" required min={0} step="0.01" value={row.unitPrice} onChange={(event) => updateRow(rowIndex, { unitPrice: event.target.value })} aria-label={`Harga ${rowName}`} /></TableCell>
                  <TableCell className="min-w-44 align-top">
                    <div className="flex flex-col gap-1">
                      {row.discountType === "NOMINAL" ? (
                        <MoneyInput
                          min={0}
                          placeholder="0"
                          value={row.discountNominal}
                          onChange={(event) => updateRow(rowIndex, { discountNominal: event.target.value })}
                          aria-label={`Diskon ${rowName}`}
                          endAddon={<DiscountToggle type={row.discountType} onChange={(mode) => updateRow(rowIndex, { discountType: mode })} label={`Diskon ${rowName}`} />}
                        />
                      ) : (
                        <InputGroup>
                          <InputGroupInput type="number" min={0} max={100} step="0.0001" inputMode="decimal" placeholder="0" value={row.discountPercent} onChange={(event) => updateRow(rowIndex, { discountPercent: event.target.value })} aria-label={`Diskon ${rowName}`} />
                          <DiscountToggle type={row.discountType} onChange={(mode) => updateRow(rowIndex, { discountType: mode })} label={`Diskon ${rowName}`} />
                        </InputGroup>
                      )}
                      <input type="hidden" name="itemDiscountType" value={row.discountType} />
                      <input type="hidden" name="itemDiscountPercent" value={row.discountType === "PERCENTAGE" ? row.discountPercent : "0"} />
                      <input type="hidden" name="itemDiscountNominal" value={row.discountType === "NOMINAL" ? row.discountNominal : "0"} />
                      {derived ? <p className="text-xs text-muted-foreground">{derived}</p> : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="hover:bg-info-surface">
              <TableCell colSpan={5} className="border-t-2 border-info/20 bg-info-surface px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Add On</p>
                      <Badge variant="info">Opsional</Badge>
                    </div>
                    <p className="text-xs text-info-surface-foreground">Berdiri sendiri di bawah seluruh produk; qty bebas, default 1.</p>
                  </div>
                  {addons.length < MAX_ADDONS ? (
                    <Button type="button" variant="outline" size="sm" onClick={addAddon} aria-label="Tambah add on invoice">
                      <Plus data-icon="inline-start" aria-hidden="true" />
                      Add On
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
            {addons.map((addon, addonIndex) => (
              <TableRow key={addon.key} className="bg-info-surface/40 hover:bg-info-surface/60">
                <TableCell>
                  <Input
                    name="addonLabel"
                    required
                    minLength={2}
                    maxLength={120}
                    value={addon.label}
                    onChange={(event) => updateAddon(addon.key, { label: event.target.value })}
                    placeholder="Keterangan add on, mis. Kerah"
                    aria-label={`Keterangan add on ${addonIndex + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    name="addonDescription"
                    maxLength={240}
                    value={addon.description}
                    onChange={(event) => updateAddon(addon.key, { description: event.target.value })}
                    placeholder="Deskripsi add on (opsional)..."
                    aria-label={`Deskripsi add on ${addonIndex + 1}`}
                  />
                </TableCell>
                <TableCell className="w-16">
                  <Input
                    name="addonQty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step="1"
                    value={addon.qty}
                    onChange={(event) => updateAddon(addon.key, { qty: event.target.value })}
                    onKeyDown={preventNonIntegerQtyKeys}
                    className="text-center font-mono tabular-nums [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={`Qty add on ${addonIndex + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <MoneyInput
                    name="addonAmount"
                    required
                    min={0}
                    step="0.01"
                    value={addon.amount}
                    onChange={(event) => updateAddon(addon.key, { amount: event.target.value })}
                    aria-label={`Harga add on ${addonIndex + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => removeAddon(addon.key)}
                    aria-label={`Hapus add on ${addonIndex + 1}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel htmlFor={`invoice-due-at-${fieldKey}`} required>Tgl. jatuh tempo</FieldLabel>
            <Input id={`invoice-due-at-${fieldKey}`} name="dueAt" type="date" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} aria-label="Tgl. jatuh tempo invoice" />
            <FieldDescription>Diisi manual; acuan jadwal Lunas dan urutan termin.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`invoice-discount-${fieldKey}`}>Diskon total</FieldLabel>
            <div className="flex flex-col gap-1">
              {orderDiscountType === "NOMINAL" ? (
                <MoneyInput
                  id={`invoice-discount-${fieldKey}`}
                  min={0}
                  placeholder="0"
                  value={orderDiscountNominal}
                  onChange={(event) => setOrderDiscountNominal(event.target.value)}
                  aria-label="Diskon total invoice"
                  endAddon={<DiscountToggle type={orderDiscountType} onChange={setOrderDiscountType} label="Diskon total" />}
                />
              ) : (
                <InputGroup>
                  <InputGroupInput id={`invoice-discount-${fieldKey}`} type="number" min={0} max={100} step="0.0001" inputMode="decimal" placeholder="0" value={orderDiscountPercent} onChange={(event) => setOrderDiscountPercent(event.target.value)} aria-label="Diskon total invoice" />
                  <DiscountToggle type={orderDiscountType} onChange={setOrderDiscountType} label="Diskon total" />
                </InputGroup>
              )}
              <input type="hidden" name="discountType" value={orderDiscountType} />
              <input type="hidden" name="discountPercent" value={orderDiscountType === "PERCENTAGE" ? orderDiscountPercent : "0"} />
              <input type="hidden" name="discountNominal" value={orderDiscountType === "NOMINAL" ? orderDiscountNominal : "0"} />
              {orderDerived ? <p className="text-xs text-muted-foreground">{orderDerived}</p> : null}
            </div>
            <FieldDescription>Dipotong dari total setelah diskon per baris.</FieldDescription>
          </Field>
          <Field><FieldLabel htmlFor={`invoice-tax-${fieldKey}`}>Pajak % (opsional)</FieldLabel><Input id={`invoice-tax-${fieldKey}`} name="taxPercent" type="number" min={0} max={100} step="0.0001" placeholder="0" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} aria-label="Pajak invoice" /></Field>
          <Field><FieldLabel htmlFor={`invoice-notes-${fieldKey}`}>Catatan invoice</FieldLabel><Textarea id={`invoice-notes-${fieldKey}`} name="notes" maxLength={2000} rows={3} defaultValue={values?.notes ?? ""} /></Field>
        </div>
        <FieldDescription>Harga akhir = total produk setelah diskon per baris, ditambah seluruh Add On (qty bebas), dikurangi diskon total, ditambah pajak, lalu dibulatkan ke kelipatan Rp500 terdekat.</FieldDescription>
        <section className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4" aria-label="Jadwal pembayaran">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Jadwal pembayaran</p>
              <p className="mt-1 text-xs text-muted-foreground">Opsional saat simpan; wajib diatur sebelum invoice diterbitkan.</p>
            </div>
            <div className="w-full sm:w-56">
              <Field>
                <FieldLabel htmlFor={`schedule-kind-${fieldKey}`}>Jenis pembayaran</FieldLabel>
                <NativeSelect
                  id={`schedule-kind-${fieldKey}`}
                  name="kind"
                  value={scheduleKind}
                  onChange={(event) => {
                    const next = event.target.value;
                    setScheduleKind(next);
                    setInitialValue("");
                    setInitialDueAt("");
                    setScheduleTerms([{ key: "term-0", value: "", dueAt: "" }]);
                    if (next !== "LUNAS") setInitialValueType("NOMINAL");
                  }}
                  className="w-full"
                >
                  <NativeSelectOption value="">Belum diatur</NativeSelectOption>
                  <NativeSelectOption value="LUNAS">Lunas</NativeSelectOption>
                  <NativeSelectOption value="DP">DP</NativeSelectOption>
                  {scheduleKind === "DEPOSIT" ? <NativeSelectOption value="DEPOSIT">Deposit (data lama)</NativeSelectOption> : null}
                </NativeSelect>
              </Field>
            </div>
          </div>
          {scheduleActive ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Total invoice</span><strong className="font-mono tabular-nums">{formatCurrency(previewTotal)}</strong></div>
                {depositAmountNumber > 0 ? (
                  <>
                    <div className="mt-2 flex items-center justify-between gap-4"><span className="text-muted-foreground">Deposit desain sudah dibayar</span><strong className="font-mono tabular-nums">{formatCurrency(depositAmountNumber)}</strong></div>
                    <div className="mt-2 flex items-center justify-between gap-4"><span className="text-muted-foreground">Sisa yang dijadwalkan</span><strong className="font-mono tabular-nums">{formatCurrency(collectibleAmount)}</strong></div>
                  </>
                ) : null}
              </div>
              {collectibleAmount <= 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>Deposit sudah menutup total invoice</AlertTitle>
                  <AlertDescription>Sesuaikan nominal deposit pada PO terlebih dahulu sebelum jadwal pembayaran disimpan.</AlertDescription>
                </Alert>
              ) : effectiveLunas ? (
                <>
                  <input type="hidden" name="initialValueType" value="PERCENTAGE" />
                  <input type="hidden" name="initialValue" value="100" />
                  <p className="text-xs text-muted-foreground">Seluruh sisa pembayaran ({formatCurrency(collectibleAmount)}) dicatat sebagai pembayaran awal; deadline mengikuti tgl. jatuh tempo invoice.</p>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`initial-value-${fieldKey}`} required>{initialValueType === "PERCENTAGE" ? "Pembayaran awal (%)" : "Nominal pembayaran awal"}</FieldLabel>
                      {initialValueType === "PERCENTAGE" ? (
                        <Input id={`initial-value-${fieldKey}`} name="initialValue" type="number" required min="0" max="100" step="0.01" inputMode="decimal" value={initialValue} onChange={(event) => setInitialValue(event.target.value)} />
                      ) : (
                        <MoneyInput id={`initial-value-${fieldKey}`} name="initialValue" required min={0} step="0.01" value={initialValue} onChange={(event) => setInitialValue(event.target.value)} />
                      )}
                      <input type="hidden" name="initialValueType" value={initialValueType} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`initial-due-at-${fieldKey}`}>Deadline {scheduleKind === "DEPOSIT" ? "deposit" : "DP"} (opsional)</FieldLabel>
                      <Input id={`initial-due-at-${fieldKey}`} name="initialDueAt" type="date" value={initialDueAt} onChange={(event) => setInitialDueAt(event.target.value)} />
                      <FieldDescription>Kosongkan bila tanpa batas; urutan termin tetap dihitung dari jatuh tempo.</FieldDescription>
                    </Field>
                  </div>
                  <p className="text-sm text-muted-foreground">Sisa setelah pembayaran awal: <span className="font-mono font-medium text-foreground">{formatCurrency(outstandingAmount)}</span></p>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Termin sisa pembayaran</p>
                      <p className="mt-1 text-xs text-muted-foreground">Total seluruh termin harus tepat sama dengan sisa setelah pembayaran awal{depositAmountNumber > 0 ? " dan deposit" : ""}. Deadline tiap termin boleh dikosongkan.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const key = scheduleTerms[scheduleTerms.length - 1].key;
                        setScheduleTerms((current) => current.map((term) => {
                          if (term.key !== key) return term;
                          const remaining = Math.max(0, outstandingAmount - current.filter((item) => item.key !== key).reduce((sum, item) => sum + (Number(item.value) || 0), 0));
                          return { ...term, value: String(Math.round(remaining * 100) / 100) };
                        }));
                      }}>Isi sisa</Button>
                      <Button type="button" variant="outline" size="sm" disabled={scheduleTerms.length >= 12} onClick={() => setScheduleTerms((current) => [...current, { key: `term-${Date.now()}-${current.length}`, value: "", dueAt: "" }])}>
                        <Plus data-icon="inline-start" aria-hidden="true" />
                        Tambah termin
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {scheduleTerms.map((term, index) => {
                      const previous = previousFilledDueAt(index) || scheduleBaseline;
                      return (
                        <div key={term.key} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
                          <input type="hidden" name="termValueType" value="NOMINAL" />
                          <Field>
                            <FieldLabel htmlFor={`term-value-${term.key}`} required>Nilai termin {index + 1}</FieldLabel>
                            <MoneyInput id={`term-value-${term.key}`} name="termValue" required min="0.01" step="0.01" value={term.value} onChange={(event) => setScheduleTerms((current) => current.map((item) => item.key === term.key ? { ...item, value: event.target.value } : item))} />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`term-date-${term.key}`}>Deadline Termin {index + 1}</FieldLabel>
                            <Input id={`term-date-${term.key}`} name="termDueAt" type="date" min={previous ? addJakartaDays(previous, 1) : undefined} value={term.dueAt} onChange={(event) => setScheduleTerms((current) => current.map((item) => item.key === term.key ? { ...item, dueAt: event.target.value } : item))} />
                          </Field>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Hapus termin ${index + 1}`} disabled={scheduleTerms.length === 1} onClick={() => setScheduleTerms((current) => current.filter((item) => item.key !== term.key))}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {collectibleAmount > 0 && !datesReady ? (
                <Alert variant="destructive">
                  <AlertTitle>Deadline termin belum berurutan</AlertTitle>
                  <AlertDescription>Termin yang mengisi deadline wajib minimal satu hari setelah {deadlineBaselineLabel}; termin berikutnya minimal satu hari setelah termin sebelumnya. Kosongkan deadline termin yang tanpa batas.</AlertDescription>
                </Alert>
              ) : collectibleAmount > 0 && !effectiveLunas && Math.abs(scheduleDifference) >= 0.005 ? (
                <Alert variant={scheduleDifference < 0 ? "destructive" : "default"}>
                  <AlertTitle>{scheduleDifference < 0 ? "Total termin melebihi sisa tagihan" : "Total termin belum menutup sisa tagihan"}</AlertTitle>
                  <AlertDescription>{scheduleDifference < 0 ? `Kurangi termin sebesar ${formatCurrency(Math.abs(scheduleDifference))}.` : `Tambahkan termin sebesar ${formatCurrency(scheduleDifference)}.`}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
        </section>
        {formState.ok === false && formState.message ? (
          <Alert variant="destructive">
            <AlertTitle>Invoice belum tersimpan</AlertTitle>
            <AlertDescription>{formState.message} Periksa harga dan diskon, lalu simpan ulang. Isian Anda tidak hilang.</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Menyimpan draft..." disabled={!scheduleReady}>{submitLabel ?? "Buat draft invoice"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
