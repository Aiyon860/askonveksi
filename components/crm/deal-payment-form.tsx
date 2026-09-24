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

type Term = { key: string; valueType: "NOMINAL" | "PERCENTAGE"; value: string; dueAt: string };

function roundPaymentAmount(value: number) {
  const scaled = value / 500;
  const lower = Math.floor(scaled);
  return (scaled - lower > 0.5 ? lower + 1 : lower) * 500;
}

function addJakartaDays(value: string, days: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day") + days)).toISOString().slice(0, 10);
}

export function DealPaymentForm({ opportunityId, opportunityVersion, purchaseOrderId, invoiceId, invoiceVersion, total, issuedAt }: {
  opportunityId: string;
  opportunityVersion: number;
  purchaseOrderId: string;
  invoiceId: string;
  invoiceVersion: number;
  total: string;
  issuedAt: string;
}) {
  const [kind, setKind] = useState<"LUNAS" | "DP">("LUNAS");
  const [initialValue, setInitialValue] = useState("");
  const [terms, setTerms] = useState<Term[]>([{ key: "term-0", valueType: "NOMINAL", value: "", dueAt: "" }]);
  const initialDueAt = addJakartaDays(issuedAt, 7);
  const totalAmount = Number(total);
  const amountFor = (valueType: Term["valueType"], value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return valueType === "PERCENTAGE" ? roundPaymentAmount(totalAmount * amount / 100) : amount;
  };
  const isLunas = kind === "LUNAS" || Number(initialValue) === 100;
  const initialAmount = amountFor("PERCENTAGE", isLunas ? "100" : initialValue);
  const outstandingAmount = totalAmount - initialAmount;
  const scheduledTermAmount = terms.reduce((sum, term) => sum + amountFor(term.valueType, term.value), 0);
  const scheduleDifference = outstandingAmount - scheduledTermAmount;
  const datesReady = terms.every((term, index) => term.dueAt >= addJakartaDays(index ? terms[index - 1].dueAt || initialDueAt : initialDueAt, 1));
  const scheduleReady = isLunas || (Math.abs(scheduleDifference) < 0.005 && datesReady);

  function fillTermRemainder(key: string) {
    setTerms((current) => {
      const remaining = Math.max(0, outstandingAmount - current.filter((term) => term.key !== key).reduce((sum, term) => sum + amountFor(term.valueType, term.value), 0));
      return current.map((term) => term.key === key ? { ...term, value: String(remaining) } : term);
    });
  }

  return (
    <form action={completeDealAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="opportunityVersion" value={opportunityVersion} />
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="invoiceVersion" value={invoiceVersion} />
      <FieldGroup>
        <FieldDescription>Sales Order dan Work Order dibuat otomatis setelah pembayaran awal dicatat di Detail Invoice.</FieldDescription>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Total invoice</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor={`payment-kind-${invoiceId}`} required>Jenis pembayaran</FieldLabel>
            <NativeSelect id={`payment-kind-${invoiceId}`} name="kind" required value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="w-full">
              <NativeSelectOption value="LUNAS">Lunas</NativeSelectOption>
              <NativeSelectOption value="DP">DP</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>

        {isLunas ? (
          <>
            <input type="hidden" name="initialValueType" value="PERCENTAGE" />
            <input type="hidden" name="initialValue" value="100" />
            <FieldDescription>Deadline pembayaran awal otomatis 7 hari setelah invoice diterbitkan. Seluruh total invoice dicatat sebagai pembayaran awal.</FieldDescription>
          </>
        ) : (
          <>
            <input type="hidden" name="initialValueType" value="PERCENTAGE" />
            <div className="grid gap-4">
              <Field>
                <FieldLabel htmlFor={`initial-value-${invoiceId}`} required>DP (%)</FieldLabel>
                <Input id={`initial-value-${invoiceId}`} name="initialValue" type="number" required min="50" max="100" step="0.01" value={initialValue} onChange={(event) => setInitialValue(event.target.value)} />
              </Field>
            </div>

            <FieldDescription>Deadline DP otomatis 7 hari setelah invoice diterbitkan. DP minimal 50%; nilai 100% diproses sebagai Lunas.</FieldDescription>
            {initialAmount > 0 && initialAmount < totalAmount ? <p className="text-sm text-muted-foreground">Sisa setelah DP: <span className="font-mono text-foreground">{formatCurrency(outstandingAmount)}</span></p> : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Termin sisa pembayaran</p>
                <p className="mt-1 text-xs text-muted-foreground">Total seluruh termin harus tepat sama dengan sisa setelah DP.</p>
              </div>
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={terms[terms.length - 1].valueType !== "NOMINAL"} onClick={() => fillTermRemainder(terms[terms.length - 1].key)}>Isi sisa</Button><Button type="button" variant="outline" size="sm" disabled={terms.length >= 12} onClick={() => setTerms((current) => [...current, { key: `term-${Date.now()}-${current.length}`, valueType: "NOMINAL", value: "", dueAt: "" }])}>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Tambah termin
              </Button></div>
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
                    <FieldLabel htmlFor={`term-date-${term.key}`} required>Deadline Termin {index + 1}</FieldLabel>
                    <Input id={`term-date-${term.key}`} name="termDueAt" type="date" required min={addJakartaDays(index ? terms[index - 1].dueAt || initialDueAt : initialDueAt, 1)} value={term.dueAt} onChange={(event) => setTerms((current) => current.map((item) => item.key === term.key ? { ...item, dueAt: event.target.value } : item))} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Hapus termin ${index + 1}`} disabled={terms.length === 1} onClick={() => setTerms((current) => current.filter((item) => item.key !== term.key))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            {!datesReady ? <Alert variant="destructive"><AlertTitle>Deadline termin belum berurutan</AlertTitle><AlertDescription>Termin 1 minimal satu hari setelah deadline DP ({initialDueAt}); termin berikutnya minimal satu hari setelah termin sebelumnya.</AlertDescription></Alert> : !scheduleReady ? <Alert variant={scheduleDifference < 0 ? "destructive" : "default"}><AlertTitle>{scheduleDifference < 0 ? "Total termin melebihi sisa tagihan" : "Total termin belum menutup sisa tagihan"}</AlertTitle><AlertDescription>{scheduleDifference < 0 ? `Kurangi termin sebesar ${formatCurrency(Math.abs(scheduleDifference))}.` : `Tambahkan termin sebesar ${formatCurrency(scheduleDifference)}.`}</AlertDescription></Alert> : null}
          </>
        )}

        <ConfirmSubmitButton disabled={!scheduleReady} pendingLabel="Menyimpan jadwal..." confirmTitle="Simpan jadwal pembayaran?" confirmDescription="Peluang tetap di Negosiasi sampai pembayaran awal dicatat dari Detail Invoice." confirmLabel="Ya, simpan jadwal">
          Simpan jadwal pembayaran
        </ConfirmSubmitButton>
      </FieldGroup>
    </form>
  );
}
