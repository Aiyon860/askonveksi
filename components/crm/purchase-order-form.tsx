"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileDown, Plus, Trash2 } from "lucide-react";

import { createPurchaseOrderDraftAction, createPurchaseOrderRevisionAction, updatePurchaseOrderDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initialFormActionState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DECORATION_METHOD_LABEL, DECORATION_METHODS, type DecorationMethod } from "@/lib/crm/constants";
import { productionDeadlineOptions } from "@/lib/crm/production-deadline";
import { cn } from "@/lib/utils";

type SizeOption = { id: string; name: string };
type MatrixRow = { sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number };
type RosterRow = { key: string; memberId: string; name: string; sizeId: string; sleeveLength: "PENDEK" | "PANJANG" | "" };
type SleeveLength = MatrixRow["sleeveLength"];

type PurchaseOrderFormValues = {
  garmentType: "JERSEY" | "NON_JERSEY" | null;
  productName: string;
  material: string;
  baseColor: string;
  variationColor: string;
  decorationMethod: string;
  orderDate: string;
  sampleSize: string;
  designNotes: string;
  notes: string;
  deadline: string;
  designDeadline: string;
  sizes: MatrixRow[];
  roster: Array<{ memberId: string; name: string; sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG" }>;
};
type Draft = PurchaseOrderFormValues & { id: string; version: number; purchaseOrderNo: string };

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function PurchaseOrderForm({
  opportunityId,
  sizeOptions,
  draft,
  initialValues,
  sourcePurchaseOrderId,
  submitLabel,
  purchaseOrderNoPreview,
}: {
  opportunityId: string;
  sizeOptions: SizeOption[];
  draft?: Draft;
  initialValues?: PurchaseOrderFormValues;
  sourcePurchaseOrderId?: string;
  submitLabel?: string;
  purchaseOrderNoPreview?: string;
}) {
  const values = draft ?? initialValues;
  const orderDate = values?.orderDate || jakartaToday();
  const fieldKey = draft?.id ?? sourcePurchaseOrderId ?? "new";
  const matrixByKey = useMemo(() => new Map(values?.sizes.map((item) => [`${item.sleeveLength}:${item.sizeId ?? item.size.toLocaleLowerCase("id-ID")}`, item.quantity])), [values]);
  const [matrix, setMatrix] = useState<Record<string, number>>(() => Object.fromEntries(
    (["PENDEK", "PANJANG"] as const).flatMap((sleeveLength) => sizeOptions.map((size) => {
      const value = matrixByKey.get(`${sleeveLength}:${size.id}`)
        ?? matrixByKey.get(`${sleeveLength}:${size.name.toLocaleLowerCase("id-ID")}`)
        ?? 0;
      return [`${sleeveLength}:${size.id}`, Math.max(0, Math.trunc(value))];
    })),
  ));
  const [roster, setRoster] = useState<RosterRow[]>(() => values?.roster.map((item, index) => ({
    key: `saved-${index}-${item.memberId}`,
    memberId: item.memberId,
    name: item.name,
    sizeId: item.sizeId ?? sizeOptions.find((size) => size.name.toLocaleLowerCase("id-ID") === item.size.toLocaleLowerCase("id-ID"))?.id ?? "",
    sleeveLength: item.sleeveLength,
  })) ?? []);
  const [rosterMode, setRosterMode] = useState<"none" | "manual" | "excel">(values?.roster.length ? "manual" : "none");
  const [garmentType, setGarmentType] = useState(values?.garmentType ?? "");
  const [selectedOrderDate, setSelectedOrderDate] = useState(orderDate);
  const [deadline, setDeadline] = useState(values?.deadline ?? "");
  const [designDeadline, setDesignDeadline] = useState(values?.designDeadline ?? "");
  const [hasChangedOrderDate, setHasChangedOrderDate] = useState(false);
  const deadlineOptions = useMemo(
    () => productionDeadlineOptions(selectedOrderDate || jakartaToday(), hasChangedOrderDate ? undefined : values?.deadline),
    [hasChangedOrderDate, selectedOrderDate, values?.deadline],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failedSubmissionRef = useRef<FormData | null>(null);
  const serverAction = draft ? updatePurchaseOrderDraftAction : sourcePurchaseOrderId ? createPurchaseOrderRevisionAction : createPurchaseOrderDraftAction;
  const [formState, formAction] = useActionState(serverAction, initialFormActionState);
  const legacyDecoration = values?.decorationMethod
    && !DECORATION_METHODS.includes(values.decorationMethod as DecorationMethod)
    ? values.decorationMethod
    : null;

  function updateMatrixValue(key: string, rawValue: string) {
    const parsed = Number(rawValue);
    const quantity = rawValue === "" || !Number.isFinite(parsed)
      ? 0
      : Math.min(10_000_000, Math.max(0, Math.trunc(parsed)));
    setMatrix((current) => ({ ...current, [key]: quantity }));
  }

  function rowTotal(sleeveLength: SleeveLength) {
    return sizeOptions.reduce((total, size) => total + (matrix[`${sleeveLength}:${size.id}`] ?? 0), 0);
  }

  useEffect(() => {
    if (formState.ok || !failedSubmissionRef.current || !formRef.current) return;
    const savedValues = failedSubmissionRef.current;
    for (const [name, value] of savedValues.entries()) {
      if (typeof value !== "string") continue;
      const controls = formRef.current.elements.namedItem(name);
      if (!controls || controls instanceof RadioNodeList) continue;
      if (!(controls instanceof HTMLInputElement || controls instanceof HTMLSelectElement || controls instanceof HTMLTextAreaElement)) continue;
      controls.value = value;
    }
  }, [formState]);

  return (
    <form ref={formRef} action={formAction} onSubmit={(event) => { failedSubmissionRef.current = new FormData(event.currentTarget); }} data-po-draft-id={draft?.id} className="min-w-0 max-w-full">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {sourcePurchaseOrderId ? <input type="hidden" name="sourcePurchaseOrderId" value={sourcePurchaseOrderId} /> : null}
      {draft ? <input type="hidden" name="purchaseOrderId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Informasi pesanan</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor={`po-reference-${fieldKey}`}>Nomor PO</FieldLabel><Input id={`po-reference-${fieldKey}`} value={draft?.purchaseOrderNo ?? purchaseOrderNoPreview ?? "Akan dibuat saat disimpan"} readOnly /></Field>
            <Field><FieldLabel htmlFor={`po-garment-${fieldKey}`} required>Jenis pakaian</FieldLabel><NativeSelect id={`po-garment-${fieldKey}`} name="garmentType" required value={garmentType} onChange={(event) => setGarmentType(event.currentTarget.value)}><NativeSelectOption value="" disabled>Pilih jenis pakaian</NativeSelectOption><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel htmlFor={`po-product-${fieldKey}`} required>Nama produk atau pola</FieldLabel><Input id={`po-product-${fieldKey}`} name="productName" required minLength={2} maxLength={120} defaultValue={values?.productName ?? ""} placeholder="Contoh: Jaket komunitas" /></Field>
            <Field><FieldLabel htmlFor={`po-material-${fieldKey}`} required>Bahan</FieldLabel><Input id={`po-material-${fieldKey}`} name="material" required minLength={2} maxLength={120} defaultValue={values?.material ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-base-color-${fieldKey}`}>Warna dasar</FieldLabel><Input id={`po-base-color-${fieldKey}`} name="baseColor" maxLength={120} defaultValue={values?.baseColor ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-variation-color-${fieldKey}`}>Warna variasi</FieldLabel><Input id={`po-variation-color-${fieldKey}`} name="variationColor" maxLength={240} defaultValue={values?.variationColor ?? ""} /></Field>
            <Field>
              <FieldLabel htmlFor={`po-decoration-${fieldKey}`} required>Metode dekorasi</FieldLabel>
              <NativeSelect
                id={`po-decoration-${fieldKey}`}
                name="decorationMethod"
                required
                defaultValue={legacyDecoration ? "" : values?.decorationMethod ?? ""}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>Pilih metode dekorasi</NativeSelectOption>
                {DECORATION_METHODS.map((method) => (
                  <NativeSelectOption key={method} value={method}>{DECORATION_METHOD_LABEL[method]}</NativeSelectOption>
                ))}
              </NativeSelect>
              {legacyDecoration ? <FieldDescription>Nilai lama “{legacyDecoration}” perlu dipilih ulang menggunakan opsi yang tersedia.</FieldDescription> : null}
            </Field>
            <Field><FieldLabel htmlFor={`po-order-date-${fieldKey}`}>Tanggal order</FieldLabel><Input id={`po-order-date-${fieldKey}`} name="orderDate" type="date" value={selectedOrderDate} onChange={(event) => { const nextOrderDate = event.currentTarget.value; setSelectedOrderDate(nextOrderDate); setDeadline(""); setDesignDeadline((current) => current && current < nextOrderDate ? "" : current); setHasChangedOrderDate(true); }} /></Field>
            <Field>
              <FieldLabel htmlFor={`po-deadline-${fieldKey}`} required>Deadline produksi</FieldLabel>
              <NativeSelect id={`po-deadline-${fieldKey}`} name="deadline" required value={deadline} onChange={(event) => setDeadline(event.currentTarget.value)} className="w-full">
                <NativeSelectOption value="" disabled>Pilih deadline produksi</NativeSelectOption>
                {deadlineOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Dihitung dari tanggal order.</FieldDescription>
            </Field>
            <Field><FieldLabel htmlFor={`po-design-deadline-${fieldKey}`} required>Deadline upload desain</FieldLabel><Input id={`po-design-deadline-${fieldKey}`} name="designDeadline" type="date" required min={selectedOrderDate || jakartaToday()} value={designDeadline} onChange={(event) => setDesignDeadline(event.currentTarget.value)} /></Field>
            {garmentType === "JERSEY" ? (
              <Field><FieldLabel htmlFor={`po-sample-size-${fieldKey}`}>Ukuran sampel</FieldLabel><NativeSelect id={`po-sample-size-${fieldKey}`} name="sampleSize" defaultValue={values?.sampleSize ?? ""}><NativeSelectOption value="">Tanpa ukuran sampel</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.name}>{size.name}</NativeSelectOption>)}</NativeSelect></Field>
            ) : null}
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Matriks ukuran dan jumlah</FieldLegend>
          <FieldDescription>Isi nol untuk kombinasi yang tidak dipesan. Total roster, jika ada, harus sama per ukuran.</FieldDescription>
          <Table containerClassName="max-w-full rounded-lg border">
            <TableHeader><TableRow><TableHead>Model</TableHead>{sizeOptions.map((size) => <TableHead key={size.id} className="min-w-[4.5rem] text-center">{size.name}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{(["PENDEK", "PANJANG"] as const).map((sleeveLength) => (
              <TableRow key={sleeveLength}>
                <TableCell className="font-medium">{sleeveLength === "PENDEK" ? "Pendek" : "Panjang"}</TableCell>
                {sizeOptions.map((size) => {
                  const key = `${sleeveLength}:${size.id}`;
                  return <TableCell key={size.id} className="p-2"><input type="hidden" name="sizeId" value={size.id} /><input type="hidden" name="sleeveLength" value={sleeveLength} /><Input name="sizeQuantity" type="number" min={0} max={10_000_000} step={1} inputMode="numeric" required value={matrix[key] ?? 0} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault(); }} onChange={(event) => updateMatrixValue(key, event.currentTarget.value)} aria-label={`${sleeveLength === "PENDEK" ? "Pendek" : "Panjang"} ukuran ${size.name}`} className="w-full min-w-0 text-center font-mono tabular-nums" /></TableCell>;
                })}
                <TableCell className="text-right font-mono font-medium tabular-nums">{rowTotal(sleeveLength)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Roster pemakai</FieldLegend>
          <FieldDescription>Opsional. Jika diisi, jumlah tiap ukuran dan panjang lengan harus sesuai matriks pesanan.</FieldDescription>
          <div className="mt-3 flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1" role="radiogroup" aria-label="Cara mengisi roster">
            {([ ["none", "Tanpa roster"], ["manual", "Ketik manual"], ["excel", "Impor Excel"] ] as const).map(([value, label]) => (
              <label key={value} className={cn("relative cursor-pointer rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring", rosterMode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}>
                <input type="radio" name="rosterMode" value={value} checked={rosterMode === value} onChange={() => setRosterMode(value)} className="sr-only" />{label}
              </label>
            ))}
          </div>
          {rosterMode === "manual" ? <div className="mt-4 flex min-w-0 flex-col gap-3">
            <Button type="button" variant="outline" size="sm" className="self-start" disabled={roster.length >= 5000} onClick={() => setRoster((current) => [...current, { key: `roster-${Date.now()}-${current.length}`, memberId: "", name: "", sizeId: "", sleeveLength: "" }])}><Plus data-icon="inline-start" aria-hidden="true" />Tambah baris</Button>
            {roster.map((row, index) => <div key={row.key} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[8rem_minmax(0,1fr)_7rem_8rem_auto] sm:items-end">
              <Field><FieldLabel htmlFor={`roster-id-${row.key}`} required>ID</FieldLabel><Input id={`roster-id-${row.key}`} name="rosterMemberId" required maxLength={80} value={row.memberId} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, memberId: event.target.value } : item))} /></Field>
              <Field><FieldLabel htmlFor={`roster-name-${row.key}`} required>Nama</FieldLabel><Input id={`roster-name-${row.key}`} name="rosterName" required minLength={2} maxLength={160} value={row.name} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, name: event.target.value } : item))} /></Field>
              <Field><FieldLabel htmlFor={`roster-size-${row.key}`} required>Ukuran</FieldLabel><NativeSelect id={`roster-size-${row.key}`} name="rosterSizeId" required value={row.sizeId} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, sizeId: event.target.value } : item))}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.id}>{size.name}</NativeSelectOption>)}</NativeSelect></Field>
              <Field><FieldLabel htmlFor={`roster-sleeve-${row.key}`} required>Lengan</FieldLabel><NativeSelect id={`roster-sleeve-${row.key}`} name="rosterSleeveLength" required value={row.sleeveLength} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, sleeveLength: event.target.value as RosterRow["sleeveLength"] } : item))}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption><NativeSelectOption value="PENDEK">Pendek</NativeSelectOption><NativeSelectOption value="PANJANG">Panjang</NativeSelectOption></NativeSelect></Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Hapus anggota ${index + 1}`} onClick={() => setRoster((current) => current.filter((item) => item.key !== row.key))}><Trash2 aria-hidden="true" /></Button>
            </div>)}
          </div> : null}
          {rosterMode === "excel" ? <div className="mt-4 flex flex-col gap-3">
            <Button size="sm" variant="outline" className="self-start" render={<Link href="/api/crm/roster-template" />} nativeButton={false}><FileDown data-icon="inline-start" aria-hidden="true" />Unduh template Excel</Button>
            <Field><FieldLabel htmlFor={`po-roster-file-${fieldKey}`}>File roster</FieldLabel><FilePicker key={formState.ok ? "ready" : "validation-error"} id={`po-roster-file-${fieldKey}`} name="rosterFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /><FieldDescription>Maksimal 2 MB dan 5.000 baris. Isi sheet Roster sesuai contoh; formula ditolak.</FieldDescription></Field>
          </div> : null}
        </FieldSet>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`po-design-${fieldKey}`}>Catatan desain</FieldLabel><Textarea id={`po-design-${fieldKey}`} name="designNotes" maxLength={4000} rows={4} defaultValue={values?.designNotes ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`po-notes-${fieldKey}`}>Catatan lain</FieldLabel><Textarea id={`po-notes-${fieldKey}`} name="notes" maxLength={4000} rows={4} defaultValue={values?.notes ?? ""} /></Field>
        </div>
        {formState.ok === false && formState.message ? (
          <Alert variant="destructive">
            <AlertTitle>PO belum tersimpan</AlertTitle>
            <AlertDescription>{formState.message} Periksa matriks ukuran dan roster, lalu simpan ulang. Isian Anda tidak hilang.</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Menyimpan PO...">{submitLabel ?? (draft ? "Perbarui draft PO" : "Buat draft PO")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
