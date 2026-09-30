"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileDown } from "lucide-react";

import { createPurchaseOrderDraftAction, createPurchaseOrderRevisionAction } from "@/app/actions/crm";
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
import { DECORATION_METHOD_LABEL, DECORATION_METHODS, GARMENT_TYPE_LABEL, type DecorationMethod } from "@/lib/crm/constants";
import { CUSTOM_PRODUCTION_DEADLINE_VALUE, isProductionDeadlinePreset, productionDeadlineOptions } from "@/lib/crm/production-deadline";
import { cn } from "@/lib/utils";

type SizeOption = { id: string; name: string };
export type ProductCategoryOption = { id: string; name: string; garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" };
type MatrixRow = { sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number };
type RosterRow = { key: string; memberId: string; name: string; sizeId: string; sleeveLength: "PENDEK" | "PANJANG" | "" };
type SleeveLength = MatrixRow["sleeveLength"];

type PurchaseOrderFormValues = {
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  productCategoryId: string | null;
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
function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function PurchaseOrderForm({
  opportunityId,
  sizeOptions,
  categoryOptions,
  initialValues,
  sourcePurchaseOrderId,
  submitLabel,
  purchaseOrderNoPreview,
}: {
  opportunityId: string;
  sizeOptions: SizeOption[];
  categoryOptions?: ProductCategoryOption[];
  initialValues?: PurchaseOrderFormValues;
  sourcePurchaseOrderId?: string;
  submitLabel?: string;
  purchaseOrderNoPreview?: string;
}) {
  const values = initialValues;
  const hasCategoryOptions = Boolean(categoryOptions?.length);
  const orderDate = values?.orderDate || jakartaToday();
  const fieldKey = sourcePurchaseOrderId ?? "new";
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
  const [productCategoryId, setProductCategoryId] = useState(() => {
    const saved = values?.productCategoryId;
    return saved && categoryOptions?.some((category) => category.id === saved) ? saved : "";
  });
  const selectedCategory = categoryOptions?.find((category) => category.id === productCategoryId);
  const effectiveGarmentType = hasCategoryOptions ? selectedCategory?.garmentType ?? "" : garmentType;
  const legacyCategory = hasCategoryOptions && Boolean(values?.garmentType) && !selectedCategory;
  const [selectedOrderDate, setSelectedOrderDate] = useState(orderDate);
  const [deadline, setDeadline] = useState(values?.deadline ?? "");
  const [deadlineMode, setDeadlineMode] = useState<"PRESET" | "CUSTOM">(() => (
    values?.deadline && !isProductionDeadlinePreset(values.deadline, orderDate) ? "CUSTOM" : "PRESET"
  ));
  const [designDeadline, setDesignDeadline] = useState(values?.designDeadline ?? "");
  const [hasChangedOrderDate, setHasChangedOrderDate] = useState(false);
  const deadlineOptions = useMemo(
    () => productionDeadlineOptions(selectedOrderDate || jakartaToday(), hasChangedOrderDate ? undefined : values?.deadline),
    [hasChangedOrderDate, selectedOrderDate, values?.deadline],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failedSubmissionRef = useRef<FormData | null>(null);
  const serverAction = sourcePurchaseOrderId ? createPurchaseOrderRevisionAction : createPurchaseOrderDraftAction;
  const [formState, formAction] = useActionState(serverAction, initialFormActionState);
  const legacyDecoration = values?.decorationMethod
    && !DECORATION_METHODS.includes(values.decorationMethod as DecorationMethod)
    ? values.decorationMethod
    : null;

  function buildDesiredRoster(source: Record<string, number>) {
    const desired: Array<{ sizeId: string; sleeveLength: "PENDEK" | "PANJANG" }> = [];
    for (const size of sizeOptions) {
      for (const sleeveLength of ["PENDEK", "PANJANG"] as const) {
        const quantity = source[`${sleeveLength}:${size.id}`] ?? 0;
        for (let index = 0; index < quantity; index += 1) desired.push({ sizeId: size.id, sleeveLength });
      }
    }
    return desired;
  }

  function reconcileRoster(prev: RosterRow[], desired: Array<{ sizeId: string; sleeveLength: "PENDEK" | "PANJANG" }>) {
    const signature = (rows: Array<{ sizeId: string; sleeveLength: string }>) =>
      rows.map((row) => `${row.sizeId}:${row.sleeveLength}`).join(",");
    if (signature(prev) === signature(desired)) {
      let needFix = prev.length !== desired.length;
      for (let index = 0; !needFix && index < prev.length; index += 1) {
        if (prev[index].memberId !== String(index + 1)) needFix = true;
      }
      if (!needFix) return prev;
      return prev.map((row, index) => (row.memberId === String(index + 1) ? row : { ...row, memberId: String(index + 1) }));
    }
    const queues = new Map<string, RosterRow[]>();
    for (const row of prev) {
      if (!row.sizeId || !row.sleeveLength) continue;
      const key = `${row.sizeId}:${row.sleeveLength}`;
      const queue = queues.get(key);
      if (queue) queue.push(row);
      else queues.set(key, [row]);
    }
    return desired.map((item, index) => {
      const reused = queues.get(`${item.sizeId}:${item.sleeveLength}`)?.shift();
      if (reused) {
        if (reused.memberId === String(index + 1) && reused.sizeId === item.sizeId && reused.sleeveLength === item.sleeveLength) return reused;
        return { ...reused, sizeId: item.sizeId, sleeveLength: item.sleeveLength, memberId: String(index + 1) };
      }
      return { key: `auto-${item.sizeId}-${item.sleeveLength}-${index}`, memberId: String(index + 1), name: "", sizeId: item.sizeId, sleeveLength: item.sleeveLength };
    });
  }

  function syncRoster(source: Record<string, number>) {
    const desired = buildDesiredRoster(source);
    if (desired.length > 5_000) return;
    setRoster((prev) => reconcileRoster(prev, desired));
  }

  function updateMatrixValue(key: string, rawValue: string) {
    const parsed = Number(rawValue);
    const quantity = rawValue === "" || !Number.isFinite(parsed)
      ? 0
      : Math.min(10_000_000, Math.max(0, Math.trunc(parsed)));
    const next = { ...matrix, [key]: quantity };
    setMatrix(next);
    if (rosterMode === "manual") syncRoster(next);
  }

  function handleRosterModeChange(next: "none" | "manual" | "excel") {
    setRosterMode(next);
    if (next === "manual") syncRoster(matrix);
  }

  function rowTotal(sleeveLength: SleeveLength) {
    return sizeOptions.reduce((total, size) => total + (matrix[`${sleeveLength}:${size.id}`] ?? 0), 0);
  }

  const rosterTotal = useMemo(
    () => sizeOptions.reduce((total, size) => total + (matrix[`PENDEK:${size.id}`] ?? 0) + (matrix[`PANJANG:${size.id}`] ?? 0), 0),
    [matrix, sizeOptions],
  );

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
    <form ref={formRef} action={formAction} onSubmit={(event) => { failedSubmissionRef.current = new FormData(event.currentTarget); }} className="min-w-0 max-w-full">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {sourcePurchaseOrderId ? <input type="hidden" name="sourcePurchaseOrderId" value={sourcePurchaseOrderId} /> : null}
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Informasi pesanan</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor={`po-reference-${fieldKey}`}>Nomor PO</FieldLabel><Input id={`po-reference-${fieldKey}`} value={purchaseOrderNoPreview ?? "Akan dibuat saat disimpan"} readOnly /></Field>
            {hasCategoryOptions ? (
              <Field>
                <FieldLabel htmlFor={`po-category-${fieldKey}`} required>Kategori produk</FieldLabel>
                <NativeSelect id={`po-category-${fieldKey}`} name="productCategoryId" required value={productCategoryId} onChange={(event) => setProductCategoryId(event.currentTarget.value)}>
                  <NativeSelectOption value="" disabled>Pilih kategori produk</NativeSelectOption>
                  {categoryOptions?.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>
                  ))}
                </NativeSelect>
                <input type="hidden" name="garmentType" value={selectedCategory?.garmentType ?? values?.garmentType ?? ""} />
                {selectedCategory ? <FieldDescription>Jenis: {GARMENT_TYPE_LABEL[selectedCategory.garmentType]}</FieldDescription> : null}
                {legacyCategory ? <FieldDescription>Kategori sebelumnya tidak tersedia. Pilih ulang kategori produk untuk PO ini.</FieldDescription> : null}
              </Field>
            ) : (
              <Field><FieldLabel htmlFor={`po-garment-${fieldKey}`} required>Jenis pakaian</FieldLabel><NativeSelect id={`po-garment-${fieldKey}`} name="garmentType" required value={garmentType} onChange={(event) => setGarmentType(event.currentTarget.value)}><NativeSelectOption value="" disabled>Pilih jenis pakaian</NativeSelectOption><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption></NativeSelect></Field>
            )}
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
            <Field><FieldLabel htmlFor={`po-order-date-${fieldKey}`}>Tanggal order</FieldLabel><Input id={`po-order-date-${fieldKey}`} name="orderDate" type="date" value={selectedOrderDate} onChange={(event) => { const nextOrderDate = event.currentTarget.value; setSelectedOrderDate(nextOrderDate); setDeadline(""); setDeadlineMode("PRESET"); setDesignDeadline((current) => current && current < nextOrderDate ? "" : current); setHasChangedOrderDate(true); }} /></Field>
            <Field>
              <FieldLabel htmlFor={`po-deadline-${fieldKey}`} required>Deadline produksi</FieldLabel>
              <NativeSelect
                id={`po-deadline-${fieldKey}`}
                required
                value={deadlineMode === "CUSTOM" ? CUSTOM_PRODUCTION_DEADLINE_VALUE : deadline}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  if (next === CUSTOM_PRODUCTION_DEADLINE_VALUE) {
                    setDeadlineMode("CUSTOM");
                    setDeadline("");
                  } else {
                    setDeadlineMode("PRESET");
                    setDeadline(next);
                  }
                }}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>Pilih deadline produksi</NativeSelectOption>
                {deadlineOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
                ))}
                <NativeSelectOption value={CUSTOM_PRODUCTION_DEADLINE_VALUE}>Tanggal kustom</NativeSelectOption>
              </NativeSelect>
              {deadlineMode === "CUSTOM" ? (
                <Input
                  id={`po-deadline-custom-${fieldKey}`}
                  name="deadline"
                  type="date"
                  required
                  min={selectedOrderDate || jakartaToday()}
                  value={deadline}
                  aria-label="Tanggal deadline produksi kustom"
                  onChange={(event) => setDeadline(event.currentTarget.value)}
                />
              ) : (
                <input type="hidden" name="deadline" value={deadline} />
              )}
              <FieldDescription>Dihitung dari tanggal order, atau pilih tanggal kustom sesuai kebutuhan.</FieldDescription>
            </Field>
            <Field><FieldLabel htmlFor={`po-design-deadline-${fieldKey}`} required>Deadline upload desain</FieldLabel><Input id={`po-design-deadline-${fieldKey}`} name="designDeadline" type="date" required min={selectedOrderDate || jakartaToday()} value={designDeadline} onChange={(event) => setDesignDeadline(event.currentTarget.value)} /></Field>
            {effectiveGarmentType === "JERSEY" ? (
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
                <input type="radio" name="rosterMode" value={value} checked={rosterMode === value} onChange={() => handleRosterModeChange(value)} className="sr-only" />{label}
              </label>
            ))}
          </div>
          {rosterMode === "manual" ? <div className="mt-4 flex min-w-0 flex-col gap-3">
            <FieldDescription>{rosterTotal > 0 ? `${rosterTotal.toLocaleString("id-ID")} baris dibuat otomatis dari matriks · ID 1..${rosterTotal.toLocaleString("id-ID")} · urut ukuran terkecil, Pendek dulu. Isi kolom Nama saja.` : "Isi matriks ukuran dulu, baris roster akan muncul otomatis di sini."}</FieldDescription>
            {rosterTotal > 5_000 ? <Alert variant="destructive"><AlertTitle>Roster melebihi 5.000 baris</AlertTitle><AlertDescription>Kurangi jumlah pada matriks atau gunakan Impor Excel.</AlertDescription></Alert> : null}
            {roster.map((row) => <div key={row.key} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_8rem] sm:items-end">
              <Field><FieldLabel htmlFor={`roster-id-${row.key}`} required>ID</FieldLabel><Input id={`roster-id-${row.key}`} name="rosterMemberId" required maxLength={80} value={row.memberId} readOnly className="bg-muted font-mono tabular-nums" /></Field>
              <Field><FieldLabel htmlFor={`roster-name-${row.key}`} required>Nama</FieldLabel><Input id={`roster-name-${row.key}`} name="rosterName" required minLength={2} maxLength={160} value={row.name} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, name: event.target.value } : item))} /></Field>
              <Field><FieldLabel htmlFor={`roster-size-${row.key}`} required>Ukuran</FieldLabel><NativeSelect id={`roster-size-${row.key}`} value={row.sizeId} disabled aria-label={`Ukuran baris ${row.memberId}`}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.id}>{size.name}</NativeSelectOption>)}</NativeSelect><input type="hidden" name="rosterSizeId" value={row.sizeId} /></Field>
              <Field><FieldLabel htmlFor={`roster-sleeve-${row.key}`} required>Lengan</FieldLabel><NativeSelect id={`roster-sleeve-${row.key}`} value={row.sleeveLength} disabled aria-label={`Lengan baris ${row.memberId}`}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption><NativeSelectOption value="PENDEK">Pendek</NativeSelectOption><NativeSelectOption value="PANJANG">Panjang</NativeSelectOption></NativeSelect><input type="hidden" name="rosterSleeveLength" value={row.sleeveLength} /></Field>
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
        <SubmitButton pendingLabel="Menyimpan PO...">{submitLabel ?? "Buat draft PO"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
