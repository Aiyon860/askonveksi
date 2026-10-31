"use client";

import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";

import { createPurchaseOrderDraftAction, createPurchaseOrderRevisionAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initialFormActionState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numericCellClass } from "@/lib/table-alignment";
import { Textarea } from "@/components/ui/textarea";
import { DECORATION_METHOD_LABEL, DECORATION_METHODS, GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { CUSTOM_PRODUCTION_DEADLINE_VALUE, isProductionDeadlinePreset, productionDeadlineOptions } from "@/lib/crm/production-deadline";
import { cn } from "@/lib/utils";

type SizeOption = { id: string; name: string };
export type ProductCategoryOption = { id: string; name: string; garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" };
type SleeveLength = "PENDEK" | "PANJANG";
type RosterMode = "none" | "manual" | "excel";
type RosterRow = { key: string; memberId: string; name: string; sizeId: string; sleeveLength: SleeveLength | "" };

export type PurchaseOrderItemValues = {
  key: string;
  name: string;
  // Revisi: Pola per produk (wajib) — sebelumnya satu isian global di header PO.
  pola: string;
  // Revisi: warna mengikuti produk — satu PO boleh memuat beberapa warna berbeda.
  // Warna dasar wajib; warna variasi (list) opsional.
  baseColor: string;
  variationColor: string;
  productCategoryId: string;
  decorationMethods: string[];
  designNotes: string;
  matrix: Record<string, number>;
  rosterMode: RosterMode;
  roster: RosterRow[];
  accessoryQuantity: string;
};

type PurchaseOrderFormValues = {
  garmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  productCategoryId: string | null;
  instansi: string;
  material: string;
  baseColor: string;
  variationColor: string;
  orderDate: string;
  sampleSize: string;
  designNotes: string;
  notes: string;
  deadline: string;
  designDeadline: string;
  depositRequired: boolean;
  items: PurchaseOrderItemValues[];
};

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function emptyMatrix(sizeOptions: SizeOption[]) {
  return Object.fromEntries(
    (["PENDEK", "PANJANG"] as const).flatMap((sleeveLength) => sizeOptions.map((size) => [`${sleeveLength}:${size.id}`, 0])),
  );
}

function newItem(key: string, sizeOptions: SizeOption[], name = ""): PurchaseOrderItemValues {
  return { key, name, pola: "", baseColor: "", variationColor: "", productCategoryId: "", decorationMethods: [], designNotes: "", matrix: emptyMatrix(sizeOptions), rosterMode: "none", roster: [], accessoryQuantity: "" };
}

function buildDesiredRoster(sizeOptions: SizeOption[], source: Record<string, number>) {
  const desired: Array<{ sizeId: string; sleeveLength: SleeveLength }> = [];
  for (const size of sizeOptions) {
    for (const sleeveLength of ["PENDEK", "PANJANG"] as const) {
      const quantity = source[`${sleeveLength}:${size.id}`] ?? 0;
      for (let index = 0; index < quantity; index += 1) desired.push({ sizeId: size.id, sleeveLength });
    }
  }
  return desired;
}

function reconcileRoster(prev: RosterRow[], desired: Array<{ sizeId: string; sleeveLength: SleeveLength }>) {
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

const AUTOSAVE_VERSION = 6;

export function PurchaseOrderForm({
  opportunityId,
  sizeOptions,
  categoryOptions,
  initialValues,
  sourcePurchaseOrderId,
  submitLabel,
  purchaseOrderNoPreview,
  defaultInstansi,
}: {
  opportunityId: string;
  sizeOptions: SizeOption[];
  categoryOptions?: ProductCategoryOption[];
  initialValues?: PurchaseOrderFormValues;
  sourcePurchaseOrderId?: string;
  submitLabel?: string;
  purchaseOrderNoPreview?: string;
  defaultInstansi?: string;
}) {
  const values = initialValues;
  const hasCategoryOptions = Boolean(categoryOptions?.length);
  const orderDate = values?.orderDate || jakartaToday();
  const fieldKey = sourcePurchaseOrderId ?? "new";
  const autosaveKey = `po-draft-v2:${opportunityId}:${fieldKey}`;
  const isNewForm = !values;

  const [items, setItems] = useState<PurchaseOrderItemValues[]>(() => {
    if (values?.items.length) {
      return values.items.map((item, index) => ({
        ...item,
        // PO lama: warna masih tersimpan di header. Pindahkan ke produk pertama supaya
        // form lama tetap terisi (produk lain boleh diberi warna sendiri).
        baseColor: item.baseColor || (index === 0 ? values.baseColor ?? "" : ""),
        variationColor: item.variationColor || (index === 0 ? values.variationColor ?? "" : ""),
        matrix: { ...emptyMatrix(sizeOptions), ...item.matrix },
        roster: item.roster.map((row, index) => ({ ...row, key: row.key || `saved-${index}-${row.memberId}` })),
      }));
    }
    return [newItem(`item-${Date.now()}`, sizeOptions)];
  });
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [header, setHeader] = useState(() => ({
    instansi: values?.instansi ?? defaultInstansi ?? "",
    material: values?.material ?? "",
    sampleSize: values?.sampleSize ?? "",
    designNotes: values?.designNotes ?? "",
    notes: values?.notes ?? "",
  }));
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
  // Checkbox Deposit: gate tombol Isi Deposit di tab PO; dapat dicentang sebelum draft terbuat.
  const [depositRequired, setDepositRequired] = useState(values?.depositRequired ?? false);
  const [hasChangedOrderDate, setHasChangedOrderDate] = useState(false);
  const [previewState, setPreviewState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const deadlineOptions = useMemo(
    () => productionDeadlineOptions(selectedOrderDate || jakartaToday(), hasChangedOrderDate ? undefined : values?.deadline),
    [hasChangedOrderDate, selectedOrderDate, values?.deadline],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failedSubmissionRef = useRef<FormData | null>(null);
  const serverAction = sourcePurchaseOrderId ? createPurchaseOrderRevisionAction : createPurchaseOrderDraftAction;
  const [formState, formAction] = useActionState(serverAction, initialFormActionState);

  // C4: pulihkan draft tersimpan (hanya form PO baru, file Excel perlu dilampirkan ulang).
  useEffect(() => {
    if (!isNewForm) return;
    try {
      const raw = localStorage.getItem(autosaveKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { v: number; header: typeof header; items: PurchaseOrderItemValues[]; depositRequired?: boolean };
      if (saved?.v !== AUTOSAVE_VERSION || !Array.isArray(saved.items) || !saved.items.length) return;
      setHeader((prev) => ({ ...prev, ...saved.header }));
      setItems(saved.items.map((item, index) => ({
        ...newItem(item.key || `item-${Date.now()}-${index}`, sizeOptions),
        ...item,
        productCategoryId: item.productCategoryId ?? "",
        matrix: { ...emptyMatrix(sizeOptions), ...item.matrix },
        roster: (item.roster ?? []).map((row, rowIndex) => ({ ...row, key: row.key || `saved-${rowIndex}-${row.memberId}` })),
      })));
      setDepositRequired(Boolean(saved.depositRequired));
      setRestoredDraft(true);
    } catch { /* Abaikan draft rusak. */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // C4: simpan otomatis tiap perubahan; hapus saat sudah tersimpan di server.
  useEffect(() => {
    if (formState.ok) {
      try { localStorage.removeItem(autosaveKey); } catch { /* Abaikan. */ }
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(autosaveKey, JSON.stringify({
          v: AUTOSAVE_VERSION,
          header,
          depositRequired,
          items: items.map(({ key, name, pola, baseColor, variationColor, productCategoryId, decorationMethods, designNotes, matrix, rosterMode, roster, accessoryQuantity }) => ({
            key, name, pola, baseColor, variationColor, productCategoryId, decorationMethods, designNotes, matrix, rosterMode,
            roster: roster.map(({ key: rowKey, memberId, name: rowName, sizeId, sleeveLength }) => ({ key: rowKey, memberId, name: rowName, sizeId, sleeveLength })),
            accessoryQuantity,
          })),
        }));
      } catch { /* Penyimpanan penuh, abaikan. */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [header, items, depositRequired, formState.ok, autosaveKey]);

  function updateItem(key: string, patch: Partial<PurchaseOrderItemValues>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    if (items.length >= 10) return;
    setItems((current) => {
      const prev = current[current.length - 1];
      const next = newItem(`item-${Date.now()}`, sizeOptions);
      // Ulangi data sebelumnya agar tinggal ubah yang beda (mis. desain berbeda).
      if (prev) {
        next.name = prev.name;
        next.decorationMethods = [...prev.decorationMethods];
      }
      // Produk 1 selalu ikut kategori PO; produk baru langsung terisi kategori PO.
      next.productCategoryId = productCategoryId;
      return [...current, next];
    });
  }

  function removeItem(key: string) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  function syncRoster(item: PurchaseOrderItemValues, source: Record<string, number>) {
    const desired = buildDesiredRoster(sizeOptions, source);
    if (desired.length > 5_000) return;
    updateItem(item.key, { roster: reconcileRoster(item.roster, desired) });
  }

  function updateMatrixValue(item: PurchaseOrderItemValues, matrixKey: string, rawValue: string) {
    const parsed = Number(rawValue);
    const quantity = rawValue === "" || !Number.isFinite(parsed)
      ? 0
      : Math.min(10_000_000, Math.max(0, Math.trunc(parsed)));
    const next = { ...item.matrix, [matrixKey]: quantity };
    updateItem(item.key, { matrix: next });
    if (item.rosterMode === "manual") syncRoster({ ...item, matrix: next }, next);
  }

  function handleRosterModeChange(item: PurchaseOrderItemValues, next: RosterMode) {
    updateItem(item.key, { rosterMode: next });
    if (next === "manual") syncRoster(item, item.matrix);
  }

  function rowTotal(item: PurchaseOrderItemValues, sleeveLength: SleeveLength) {
    return sizeOptions.reduce((total, size) => total + (item.matrix[`${sleeveLength}:${size.id}`] ?? 0), 0);
  }

  function rosterTotal(item: PurchaseOrderItemValues) {
    return sizeOptions.reduce((total, size) => total + (item.matrix[`PENDEK:${size.id}`] ?? 0) + (item.matrix[`PANJANG:${size.id}`] ?? 0), 0);
  }

  function toggleDecoration(item: PurchaseOrderItemValues, method: string) {
    const next = item.decorationMethods.includes(method)
      ? item.decorationMethods.filter((value) => value !== method)
      : [...item.decorationMethods, method];
    updateItem(item.key, { decorationMethods: next });
  }

  // C3: pratinjau Excel → isi matriks otomatis sesuai isi file.
  async function previewRosterFile(item: PurchaseOrderItemValues, file: File) {
    setPreviewState((prev) => ({ ...prev, [item.key]: { loading: true, error: null } }));
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/crm/roster-preview", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; message?: string; counts?: Array<{ sleeveLength: SleeveLength; size: string; quantity: number }> };
      if (!result.ok) throw new Error(result.message || "File roster tidak valid.");
      const byName = new Map(sizeOptions.map((size) => [size.name.toLocaleLowerCase("id-ID"), size.id]));
      const next = emptyMatrix(sizeOptions);
      const unknown: string[] = [];
      for (const row of result.counts ?? []) {
        const id = byName.get(row.size.toLocaleLowerCase("id-ID"));
        if (!id) { unknown.push(row.size); continue; }
        next[`${row.sleeveLength}:${id}`] = (next[`${row.sleeveLength}:${id}`] ?? 0) + row.quantity;
      }
      updateItem(item.key, { matrix: next });
      setPreviewState((prev) => ({
        ...prev,
        [item.key]: { loading: false, error: unknown.length ? `Ukuran tidak dikenal (tidak ikut terisi): ${[...new Set(unknown)].join(", ")}` : null },
      }));
    } catch (error) {
      setPreviewState((prev) => ({ ...prev, [item.key]: { loading: false, error: error instanceof Error ? error.message : "File roster tidak valid." } }));
    }
  }

  function handleRosterFileChange(item: PurchaseOrderItemValues, file: File | undefined) {
    if (file && item.rosterMode === "excel") void previewRosterFile(item, file);
  }

  function updateAccessoryQuantity(item: PurchaseOrderItemValues, rawValue: string) {
    if (rawValue === "") {
      updateItem(item.key, { accessoryQuantity: "" });
      return;
    }
    if (!/^\d+$/.test(rawValue.trim())) return;
    updateItem(item.key, { accessoryQuantity: String(Math.min(10_000_000, Math.max(0, Number(rawValue.trim())))) });
  }

  function handleCategoryChange(nextId: string) {
    setProductCategoryId(nextId);
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
    <form ref={formRef} action={formAction} onSubmit={(event) => { failedSubmissionRef.current = new FormData(event.currentTarget); }} className="min-w-0 max-w-full">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {sourcePurchaseOrderId ? <input type="hidden" name="sourcePurchaseOrderId" value={sourcePurchaseOrderId} /> : null}
      <FieldGroup>
        {restoredDraft ? <Alert><AlertTitle>Draft tersimpan dipulihkan</AlertTitle><AlertDescription>Isian terakhir Anda dikembalikan otomatis. Lampirkan ulang file Excel bila memakai Impor Excel.</AlertDescription></Alert> : null}
        <FieldSet>
          <FieldLegend>Informasi pesanan</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor={`po-reference-${fieldKey}`}>Nomor PO</FieldLabel><Input id={`po-reference-${fieldKey}`} value={purchaseOrderNoPreview ?? "Akan dibuat saat disimpan"} readOnly /></Field>
            {hasCategoryOptions ? (
              <Field>
                <FieldLabel htmlFor={`po-category-${fieldKey}`} required>Kategori produk</FieldLabel>
                <NativeSelect id={`po-category-${fieldKey}`} name="productCategoryId" required value={productCategoryId} onChange={(event) => handleCategoryChange(event.currentTarget.value)}>
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
            <Field><FieldLabel htmlFor={`po-instansi-${fieldKey}`} required>Instansi</FieldLabel><Input id={`po-instansi-${fieldKey}`} name="instansi" required minLength={2} maxLength={160} value={header.instansi} onChange={(event) => setHeader((prev) => ({ ...prev, instansi: event.target.value }))} placeholder="Contoh: PT Maju / Dinas Pendidikan" /></Field>
            <Field><FieldLabel htmlFor={`po-material-${fieldKey}`} required>Bahan</FieldLabel><Input id={`po-material-${fieldKey}`} name="material" required minLength={2} maxLength={120} value={header.material} onChange={(event) => setHeader((prev) => ({ ...prev, material: event.target.value }))} /></Field>
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
            <Field>
              <FieldLabel htmlFor={`po-deposit-required-${fieldKey}`}>Deposit</FieldLabel>
              <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors", depositRequired ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted/50")}>
                <Checkbox checked={depositRequired} onCheckedChange={(checked) => setDepositRequired(checked)} aria-label="PO ini memerlukan deposit" />
                Perlu deposit
                <input id={`po-deposit-required-${fieldKey}`} type="checkbox" name="depositRequired" checked={depositRequired} readOnly className="sr-only" />
              </label>
              <FieldDescription>Centang bila customer membayar deposit desain. Tombol Isi Deposit di tab PO muncul hanya untuk PO yang dicentang.</FieldDescription>
            </Field>
            {effectiveGarmentType === "JERSEY" ? (
              <Field><FieldLabel htmlFor={`po-sample-size-${fieldKey}`}>Ukuran sampel</FieldLabel><NativeSelect id={`po-sample-size-${fieldKey}`} name="sampleSize" value={header.sampleSize} onChange={(event) => setHeader((prev) => ({ ...prev, sampleSize: event.target.value }))}><NativeSelectOption value="">Tanpa ukuran sampel</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.name}>{size.name}</NativeSelectOption>)}</NativeSelect></Field>
            ) : null}
          </div>
        </FieldSet>

        {items.map((item, index) => {
          const prefix = `item-${index}-`;
          const total = rosterTotal(item);
          const itemCategory = categoryOptions?.find((category) => category.id === item.productCategoryId);
          const itemGarment = itemCategory?.garmentType ?? effectiveGarmentType;
          const itemIsAccessory = itemGarment === "AKSESORI";
          return (
            <Fragment key={item.key}>
            <FieldSet className="rounded-xl border-2 border-primary/25 bg-primary/[0.04] p-4">
              <FieldLegend className="rounded-full bg-primary px-4 py-1 font-semibold text-primary-foreground">{items.length > 1 ? `Produk ${index + 1}${item.name ? ` — ${item.name}` : ""}` : "Produk"}</FieldLegend>
              <input type="hidden" name="itemKey" value={item.key} />
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Revisi: isian global "Nama Produk" dihapus — nama + pola kini sebaris per produk. */}
                <Field><FieldLabel htmlFor={`${prefix}name-${fieldKey}`} required>Nama produk</FieldLabel><Input id={`${prefix}name-${fieldKey}`} name={`${prefix}name`} required minLength={2} maxLength={120} value={item.name} onChange={(event) => updateItem(item.key, { name: event.target.value })} placeholder="Contoh: Jersey home" /></Field>
                <Field><FieldLabel htmlFor={`${prefix}pola-${fieldKey}`} required>Pola</FieldLabel><Input id={`${prefix}pola-${fieldKey}`} name={`${prefix}pola`} required minLength={2} maxLength={120} value={item.pola} onChange={(event) => updateItem(item.key, { pola: event.target.value })} placeholder="Contoh: Jaket komunitas" /></Field>
                {/* Revisi: warna mengikuti produk — tiap produk boleh beda warna dalam satu nomor PO. */}
                <Field>
                  <FieldLabel htmlFor={`${prefix}base-color-${fieldKey}`} required>Warna dasar</FieldLabel>
                  <Input
                    id={`${prefix}base-color-${fieldKey}`}
                    name={`${prefix}baseColor`}
                    required
                    maxLength={120}
                    value={item.baseColor}
                    onChange={(event) => updateItem(item.key, { baseColor: event.target.value })}
                    placeholder="Contoh: Navy"
                    aria-label={`Warna dasar produk ${index + 1}`}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${prefix}variation-color-${fieldKey}`}>Warna variasi</FieldLabel>
                  <Input
                    id={`${prefix}variation-color-${fieldKey}`}
                    name={`${prefix}variationColor`}
                    maxLength={240}
                    value={item.variationColor}
                    onChange={(event) => updateItem(item.key, { variationColor: event.target.value })}
                    placeholder="Opsional, contoh: Putih di list lengan"
                    aria-label={`Warna variasi produk ${index + 1}`}
                  />
                </Field>
                {hasCategoryOptions && items.length > 1 && index > 0 ? (
                  <Field>
                    <FieldLabel htmlFor={`${prefix}category-${fieldKey}`} required>Kategori Produk {index + 1}</FieldLabel>
                    <NativeSelect id={`${prefix}category-${fieldKey}`} name={`${prefix}productCategoryId`} required value={item.productCategoryId} onChange={(event) => updateItem(item.key, { productCategoryId: event.target.value })} className="w-full">
                      <NativeSelectOption value="" disabled>Pilih kategori produk</NativeSelectOption>
                      {categoryOptions?.map((category) => (
                        <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>Beda jenis produk wajib beda kategori.</FieldDescription>
                  </Field>
                ) : null}
                <Field className="sm:col-span-2">
                  <FieldLabel required>Metode dekorasi</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {DECORATION_METHODS.map((method) => (
                      <label key={method} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors", item.decorationMethods.includes(method) ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted/50")}>
                        <Checkbox checked={item.decorationMethods.includes(method)} onCheckedChange={() => toggleDecoration(item, method)} aria-label={`${DECORATION_METHOD_LABEL[method]} produk ${index + 1}`} />
                        {DECORATION_METHOD_LABEL[method]}
                        <input type="checkbox" name={`${prefix}decorationMethod`} value={method} checked={item.decorationMethods.includes(method)} readOnly className="sr-only" />
                      </label>
                    ))}
                  </div>
                </Field>
              </div>

              {itemIsAccessory ? (
                <div className="mt-4 grid gap-4 sm:max-w-xs">
                  <Field>
                    <FieldLabel htmlFor={`${prefix}accessory-${fieldKey}`} required>Jumlah produk</FieldLabel>
                    <input type="hidden" name={`${prefix}sizeId`} value={sizeOptions[0]?.id ?? ""} />
                    <input type="hidden" name={`${prefix}sleeveLength`} value="PENDEK" />
                    <input type="hidden" name={`${prefix}rosterMode`} value="none" />
                    <Input
                      id={`${prefix}accessory-${fieldKey}`}
                      name={`${prefix}sizeQuantity`}
                      type="number"
                      min={1}
                      max={10_000_000}
                      step={1}
                      inputMode="numeric"
                      required
                      value={item.accessoryQuantity}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => { if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault(); }}
                      onChange={(event) => updateAccessoryQuantity(item, event.currentTarget.value)}
                      aria-label={`Jumlah produk ${item.name || index + 1}`}
                      className="w-full text-center font-mono tabular-nums"
                    />
                  </Field>
                </div>
              ) : (
                <>
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
                            return <TableCell key={size.id} className="p-2"><input type="hidden" name={`${prefix}sizeId`} value={size.id} /><input type="hidden" name={`${prefix}sleeveLength`} value={sleeveLength} /><Input name={`${prefix}sizeQuantity`} type="number" min={0} max={10_000_000} step={1} inputMode="numeric" required value={item.matrix[key] ?? 0} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault(); }} onChange={(event) => updateMatrixValue(item, key, event.currentTarget.value)} aria-label={`${sleeveLength === "PENDEK" ? "Pendek" : "Panjang"} ukuran ${size.name} produk ${index + 1}`} className="w-full min-w-0 text-center font-mono tabular-nums" /></TableCell>;
                          })}
                          <TableCell className={numericCellClass(rowTotal(item, sleeveLength), "text-right font-mono font-medium tabular-nums")}>{rowTotal(item, sleeveLength)}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </FieldSet>

                  <FieldSet>
                    <FieldLegend>Roster pemakai</FieldLegend>
                    <FieldDescription>Opsional. Jika diisi, jumlah tiap ukuran dan panjang lengan harus sesuai matriks pesanan.</FieldDescription>
                    <div className="mt-3 flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1" role="radiogroup" aria-label={`Cara mengisi roster produk ${index + 1}`}>
                      {([["none", "Tanpa roster"], ["manual", "Ketik manual"], ["excel", "Impor Excel"]] as const).map(([value, label]) => (
                        <label key={value} className={cn("relative cursor-pointer rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring", item.rosterMode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}>
                          <input type="radio" name={`${prefix}rosterMode`} value={value} checked={item.rosterMode === value} onChange={() => handleRosterModeChange(item, value)} className="sr-only" />{label}
                        </label>
                      ))}
                    </div>
                    {item.rosterMode === "manual" ? <div className="mt-4 flex min-w-0 flex-col gap-3">
                      <FieldDescription>{total > 0 ? `${total.toLocaleString("id-ID")} baris dibuat otomatis dari matriks · ID 1..${total.toLocaleString("id-ID")} · urut ukuran terkecil, Pendek dulu. Isi kolom Nama saja.` : "Isi matriks ukuran dulu, baris roster akan muncul otomatis di sini."}</FieldDescription>
                      {total > 5_000 ? <Alert variant="destructive"><AlertTitle>Roster melebihi 5.000 baris</AlertTitle><AlertDescription>Kurangi jumlah pada matriks atau gunakan Impor Excel.</AlertDescription></Alert> : null}
                      {item.roster.map((row) => <div key={row.key} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_8rem] sm:items-end">
                        <Field><FieldLabel htmlFor={`roster-id-${item.key}-${row.key}`} required>ID</FieldLabel><Input id={`roster-id-${item.key}-${row.key}`} name={`${prefix}rosterMemberId`} required maxLength={80} value={row.memberId} readOnly className="bg-muted font-mono tabular-nums" /></Field>
                        <Field><FieldLabel htmlFor={`roster-name-${item.key}-${row.key}`} required>Nama</FieldLabel><Input id={`roster-name-${item.key}-${row.key}`} name={`${prefix}rosterName`} required minLength={2} maxLength={160} value={row.name} onChange={(event) => updateItem(item.key, { roster: item.roster.map((entry) => entry.key === row.key ? { ...entry, name: event.target.value } : entry) })} /></Field>
                        <Field><FieldLabel htmlFor={`roster-size-${item.key}-${row.key}`} required>Ukuran</FieldLabel><NativeSelect id={`roster-size-${item.key}-${row.key}`} value={row.sizeId} disabled aria-label={`Ukuran baris ${row.memberId}`}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.id}>{size.name}</NativeSelectOption>)}</NativeSelect><input type="hidden" name={`${prefix}rosterSizeId`} value={row.sizeId} /></Field>
                        <Field><FieldLabel htmlFor={`roster-sleeve-${item.key}-${row.key}`} required>Lengan</FieldLabel><NativeSelect id={`roster-sleeve-${item.key}`} value={row.sleeveLength} disabled aria-label={`Lengan baris ${row.memberId}`}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption><NativeSelectOption value="PENDEK">Pendek</NativeSelectOption><NativeSelectOption value="PANJANG">Panjang</NativeSelectOption></NativeSelect><input type="hidden" name={`${prefix}rosterSleeveLength`} value={row.sleeveLength} /></Field>
                      </div>)}
                    </div> : null}
                    {item.rosterMode === "excel" ? <div className="mt-4 flex flex-col gap-3">
                      <Button size="sm" variant="outline" className="self-start" render={<a href="/api/crm/roster-template" download />} nativeButton={false}><FileDown data-icon="inline-start" aria-hidden="true" />Unduh template Excel</Button>
                      <Field><FieldLabel htmlFor={`${prefix}roster-file-${fieldKey}`}>File roster</FieldLabel><FilePicker key={formState.ok ? "ready" : "validation-error"} id={`${prefix}roster-file-${fieldKey}`} name={`${prefix}rosterFile`} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={(event) => handleRosterFileChange(item, event.currentTarget.files?.[0])} /><FieldDescription>Maksimal 2 MB dan 5.000 baris. Matriks produk ini terisi otomatis sesuai isi file.</FieldDescription></Field>
                      {previewState[item.key]?.loading ? <FieldDescription> Membaca file Excel…</FieldDescription> : null}
                      {previewState[item.key]?.error ? <Alert variant="destructive"><AlertTitle>Pratinjau roster</AlertTitle><AlertDescription>{previewState[item.key]?.error}</AlertDescription></Alert> : null}
                    </div> : null}
                  </FieldSet>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor={`${prefix}design-${fieldKey}`}>Catatan desain{items.length > 1 ? ` produk ${index + 1}` : ""}</FieldLabel><Textarea id={`${prefix}design-${fieldKey}`} name={`${prefix}designNotes`} maxLength={4000} rows={3} value={item.designNotes} onChange={(event) => updateItem(item.key, { designNotes: event.target.value })} /></Field>
                {items.length > 1 && index > 0 ? (
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeItem(item.key)}>
                      <Trash2 data-icon="inline-start" aria-hidden="true" />Hapus produk ini
                    </Button>
                  </div>
                ) : null}
              </div>
            </FieldSet>
            {index < items.length - 1 ? (
              <div className="flex items-center gap-3" aria-hidden="true">
                <Separator className="flex-1" />
                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Produk berikutnya</span>
                <Separator className="flex-1" />
              </div>
            ) : null}
            </Fragment>
          );
        })}

        <Button type="button" variant="default" className="self-start" onClick={addItem} disabled={items.length >= 10}>
          <Plus data-icon="inline-start" aria-hidden="true" />Tambah produk
        </Button>
        <FieldDescription>Setiap produk punya warna sendiri, jadi satu nomor PO boleh memuat beberapa warna berbeda. Warna dasar wajib diisi; warna variasi opsional.</FieldDescription>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`po-design-${fieldKey}`}>Catatan desain umum</FieldLabel><Textarea id={`po-design-${fieldKey}`} name="designNotes" maxLength={4000} rows={4} value={header.designNotes} onChange={(event) => setHeader((prev) => ({ ...prev, designNotes: event.target.value }))} /></Field>
          <Field><FieldLabel htmlFor={`po-notes-${fieldKey}`}>Catatan lain</FieldLabel><Textarea id={`po-notes-${fieldKey}`} name="notes" maxLength={4000} rows={4} value={header.notes} onChange={(event) => setHeader((prev) => ({ ...prev, notes: event.target.value }))} /></Field>
        </div>
        {formState.ok === false && formState.message ? (
          <Alert variant="destructive">
            <AlertTitle>PO belum tersimpan</AlertTitle>
            <AlertDescription>{formState.message} Periksa jumlah produk, matriks ukuran, dan roster, lalu simpan ulang. Isian Anda tidak hilang.</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Menyimpan PO...">{submitLabel ?? "Buat draft PO"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
