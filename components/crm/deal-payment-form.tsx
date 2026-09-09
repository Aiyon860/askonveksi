"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { completeDealAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/crm/format";

type Term = { key: string; valueType: "NOMINAL" | "PERCENTAGE"; value: string };

export function DealPaymentForm({ opportunityId, opportunityVersion, purchaseOrderId, invoiceId, invoiceVersion, total, initialPaidAt, paymentMethods }: {
  opportunityId: string;
  opportunityVersion: number;
  purchaseOrderId: string;
  invoiceId: string;
  invoiceVersion: number;
  total: string;
  initialPaidAt: string;
  paymentMethods: Array<{ id: string; name: string }>;
}) {
  const [kind, setKind] = useState<"LUNAS" | "DP">("LUNAS");
  const [initialValueType, setInitialValueType] = useState<"NOMINAL" | "PERCENTAGE">("NOMINAL");
  const [initialValue, setInitialValue] = useState("");
  const [terms, setTerms] = useState<Term[]>([{ key: "term-0", valueType: "NOMINAL", value: "" }]);
  const totalAmount = Number(total);
  const amountFor = (valueType: Term["valueType"], value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return valueType === "PERCENTAGE" ? Math.round(totalAmount * amount) / 100 : amount;
  };
  const initialAmount = amountFor(initialValueType, initialValue);
  const outstandingAmount = totalAmount - initialAmount;
  const scheduledTermAmount = terms.reduce((sum, term) => sum + amountFor(term.valueType, term.value), 0);
  const scheduleDifference = outstandingAmount - scheduledTermAmount;
  const scheduleReady = kind === "LUNAS" || Math.abs(scheduleDifference) < 0.005;

  return (
    <form action={completeDealAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="opportunityVersion" value={opportunityVersion} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="invoiceVersion" value={invoiceVersion} />
      <FieldGroup>
        <FieldDescription>Work Order dibuat otomatis dari jenis pakaian, produk, jumlah, dan deadline pada PO setelah pembayaran ini dicatat.</FieldDescription>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Total invoice</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`payment-kind-${invoiceId}`} required>Jenis pembayaran</FieldLabel>
            <NativeSelect id={`payment-kind-${invoiceId}`} name="kind" required value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="w-full">
              <NativeSelectOption value="LUNAS">Lunas</NativeSelectOption>
              <NativeSelectOption value="DP">DP</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`payment-date-${invoiceId}`} required>Waktu pembayaran</FieldLabel>
            <Input id={`payment-date-${invoiceId}`} name="paidAt" type="datetime-local" required defaultValue={initialPaidAt} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`payment-method-${invoiceId}`} required>Metode pembayaran</FieldLabel>
            <NativeSelect id={`payment-method-${invoiceId}`} name="paymentMethodId" required defaultValue="" className="w-full">
              <NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>
              {paymentMethods.map((method) => <NativeSelectOption key={method.id} value={method.id}>{method.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        </div>

        {kind === "LUNAS" ? (
          <>
            <input type="hidden" name="initialValueType" value="NOMINAL" />
            <input type="hidden" name="initialValue" value={total} />
            <FieldDescription>Seluruh total invoice dicatat sebagai pembayaran awal.</FieldDescription>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`initial-type-${invoiceId}`} required>Format DP</FieldLabel>
                <NativeSelect id={`initial-type-${invoiceId}`} name="initialValueType" required value={initialValueType} onChange={(event) => setInitialValueType(event.target.value as typeof initialValueType)} className="w-full">
                  <NativeSelectOption value="NOMINAL">Nominal</NativeSelectOption>
                  <NativeSelectOption value="PERCENTAGE">Persentase</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`initial-value-${invoiceId}`} required>Nilai DP</FieldLabel>
                <Input id={`initial-value-${invoiceId}`} name="initialValue" type="number" required min="0.01" max={initialValueType === "PERCENTAGE" ? 100 : undefined} step="0.01" value={initialValue} onChange={(event) => setInitialValue(event.target.value)} />
              </Field>
            </div>

            {initialAmount > 0 && initialAmount < totalAmount ? <p className="text-sm text-muted-foreground">Sisa setelah DP: <span className="font-mono text-foreground">{formatCurrency(outstandingAmount)}</span></p> : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Termin sisa pembayaran</p>
                <p className="mt-1 text-xs text-muted-foreground">Total seluruh termin harus tepat sama dengan sisa setelah DP.</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={terms.length >= 12} onClick={() => setTerms((current) => [...current, { key: `term-${Date.now()}-${current.length}`, valueType: "NOMINAL", value: "" }])}>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Tambah termin
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {terms.map((term, index) => (
                <div key={term.key} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[9rem_minmax(0,1fr)_10rem_auto] sm:items-end">
                  <Field>
                    <FieldLabel htmlFor={`term-type-${term.key}`} required>Format</FieldLabel>
                    <NativeSelect id={`term-type-${term.key}`} name="termValueType" required value={term.valueType} onChange={(event) => setTerms((current) => current.map((item) => item.key === term.key ? { ...item, valueType: event.target.value as Term["valueType"] } : item))} className="w-full">
                      <NativeSelectOption value="NOMINAL">Nominal</NativeSelectOption>
                      <NativeSelectOption value="PERCENTAGE">Persentase</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`term-value-${term.key}`} required>Nilai termin {index + 1}</FieldLabel>
                    <Input id={`term-value-${term.key}`} name="termValue" type="number" required min="0.01" max={term.valueType === "PERCENTAGE" ? 100 : undefined} step="0.01" value={term.value} onChange={(event) => setTerms((current) => current.map((item) => item.key === term.key ? { ...item, value: event.target.value } : item))} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`term-date-${term.key}`} required>Jatuh tempo</FieldLabel>
                    <Input id={`term-date-${term.key}`} name="termDueAt" type="date" required />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Hapus termin ${index + 1}`} disabled={terms.length === 1} onClick={() => setTerms((current) => current.filter((item) => item.key !== term.key))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            {!scheduleReady ? <Alert variant={scheduleDifference < 0 ? "destructive" : "default"}><AlertTitle>{scheduleDifference < 0 ? "Total termin melebihi sisa tagihan" : "Total termin belum menutup sisa tagihan"}</AlertTitle><AlertDescription>{scheduleDifference < 0 ? `Kurangi termin sebesar ${formatCurrency(Math.abs(scheduleDifference))}.` : `Tambahkan termin sebesar ${formatCurrency(scheduleDifference)}.`}</AlertDescription></Alert> : null}
          </>
        )}

        <ConfirmSubmitButton disabled={!scheduleReady} pendingLabel="Membentuk order..." confirmTitle="Konfirmasi pembayaran dan Deal?" confirmDescription="Peluang menjadi Deal. Sales Order dan Work Order Produksi dibuat otomatis dari PO serta invoice ini." confirmLabel="Ya, catat Deal">
          Catat pembayaran dan pindahkan ke Deal
        </ConfirmSubmitButton>
      </FieldGroup>
    </form>
  );
}
