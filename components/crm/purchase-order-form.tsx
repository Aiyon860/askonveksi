"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createPurchaseOrderDraftAction, updatePurchaseOrderDraftAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DECORATION_METHOD_LABEL, DECORATION_METHODS, type DecorationMethod } from "@/lib/crm/constants";

type SizeOption = { id: string; name: string };
type MatrixRow = { sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number };
type RosterRow = { key: string; memberId: string; name: string; sizeId: string };
type SleeveLength = MatrixRow["sleeveLength"];

type Draft = {
  id: string;
  version: number;
  customerReference: string;
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
  attachmentCount: number;
  sizes: MatrixRow[];
  roster: Array<{ memberId: string; name: string; sizeId: string | null; size: string }>;
};

const ATTACHMENT_KINDS = [
  ["MAIN_DESIGN", "Desain utama"], ["FRONT", "Tampak depan"], ["BACK", "Tampak belakang"],
  ["LOGO_RIGHT", "Logo kanan"], ["LOGO_BACK", "Logo belakang"], ["LOGO_FRONT", "Logo depan"], ["OTHER", "Lainnya"],
] as const;

export function PurchaseOrderForm({ opportunityId, sizeOptions, draft }: { opportunityId: string; sizeOptions: SizeOption[]; draft?: Draft }) {
  const matrixByKey = useMemo(() => new Map(draft?.sizes.map((item) => [`${item.sleeveLength}:${item.sizeId ?? item.size.toLocaleLowerCase("id-ID")}`, item.quantity])), [draft]);
  const [matrix, setMatrix] = useState<Record<string, number>>(() => Object.fromEntries(
    (["PENDEK", "PANJANG"] as const).flatMap((sleeveLength) => sizeOptions.map((size) => {
      const value = matrixByKey.get(`${sleeveLength}:${size.id}`)
        ?? matrixByKey.get(`${sleeveLength}:${size.name.toLocaleLowerCase("id-ID")}`)
        ?? 0;
      return [`${sleeveLength}:${size.id}`, Math.max(0, Math.trunc(value))];
    })),
  ));
  const [roster, setRoster] = useState<RosterRow[]>(() => draft?.roster.map((item, index) => ({
    key: `saved-${index}-${item.memberId}`,
    memberId: item.memberId,
    name: item.name,
    sizeId: item.sizeId ?? sizeOptions.find((size) => size.name.toLocaleLowerCase("id-ID") === item.size.toLocaleLowerCase("id-ID"))?.id ?? "",
  })) ?? []);
  const [attachmentRows, setAttachmentRows] = useState(() => [{ key: "attachment-0", kind: "MAIN_DESIGN" }]);
  const action = draft ? updatePurchaseOrderDraftAction : createPurchaseOrderDraftAction;
  const legacyDecoration = draft?.decorationMethod
    && !DECORATION_METHODS.includes(draft.decorationMethod as DecorationMethod)
    ? draft.decorationMethod
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

  return (
    <form action={action} encType="multipart/form-data">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {draft ? <input type="hidden" name="purchaseOrderId" value={draft.id} /> : null}
      {draft ? <input type="hidden" name="version" value={draft.version} /> : null}
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Informasi pesanan</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor={`po-reference-${draft?.id ?? "new"}`}>Nomor PO customer</FieldLabel><Input id={`po-reference-${draft?.id ?? "new"}`} name="customerReference" maxLength={120} defaultValue={draft?.customerReference ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-garment-${draft?.id ?? "new"}`} required>Jenis pakaian</FieldLabel><NativeSelect id={`po-garment-${draft?.id ?? "new"}`} name="garmentType" required defaultValue={draft?.garmentType ?? ""}><NativeSelectOption value="" disabled>Pilih jenis pakaian</NativeSelectOption><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel htmlFor={`po-product-${draft?.id ?? "new"}`} required>Nama produk atau pola</FieldLabel><Input id={`po-product-${draft?.id ?? "new"}`} name="productName" required minLength={2} maxLength={120} defaultValue={draft?.productName ?? ""} placeholder="Contoh: Jaket komunitas" /></Field>
            <Field><FieldLabel htmlFor={`po-material-${draft?.id ?? "new"}`} required>Bahan</FieldLabel><Input id={`po-material-${draft?.id ?? "new"}`} name="material" required minLength={2} maxLength={120} defaultValue={draft?.material ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-base-color-${draft?.id ?? "new"}`}>Warna dasar</FieldLabel><Input id={`po-base-color-${draft?.id ?? "new"}`} name="baseColor" maxLength={120} defaultValue={draft?.baseColor ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-variation-color-${draft?.id ?? "new"}`}>Warna variasi</FieldLabel><Input id={`po-variation-color-${draft?.id ?? "new"}`} name="variationColor" maxLength={240} defaultValue={draft?.variationColor ?? ""} /></Field>
            <Field>
              <FieldLabel htmlFor={`po-decoration-${draft?.id ?? "new"}`} required>Metode dekorasi</FieldLabel>
              <NativeSelect
                id={`po-decoration-${draft?.id ?? "new"}`}
                name="decorationMethod"
                required
                defaultValue={legacyDecoration ? "" : draft?.decorationMethod ?? ""}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>Pilih metode dekorasi</NativeSelectOption>
                {DECORATION_METHODS.map((method) => (
                  <NativeSelectOption key={method} value={method}>{DECORATION_METHOD_LABEL[method]}</NativeSelectOption>
                ))}
              </NativeSelect>
              {legacyDecoration ? <FieldDescription>Nilai lama “{legacyDecoration}” perlu dipilih ulang menggunakan opsi yang tersedia.</FieldDescription> : null}
            </Field>
            <Field><FieldLabel htmlFor={`po-order-date-${draft?.id ?? "new"}`}>Tanggal order</FieldLabel><Input id={`po-order-date-${draft?.id ?? "new"}`} name="orderDate" type="date" defaultValue={draft?.orderDate ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-deadline-${draft?.id ?? "new"}`}>Deadline customer</FieldLabel><Input id={`po-deadline-${draft?.id ?? "new"}`} name="deadline" type="date" defaultValue={draft?.deadline ?? ""} /></Field>
            <Field><FieldLabel htmlFor={`po-sample-size-${draft?.id ?? "new"}`}>Ukuran sampel</FieldLabel><NativeSelect id={`po-sample-size-${draft?.id ?? "new"}`} name="sampleSize" defaultValue={draft?.sampleSize ?? ""}><NativeSelectOption value="">Tanpa ukuran sampel</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.name}>{size.name}</NativeSelectOption>)}</NativeSelect></Field>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Matriks ukuran dan jumlah</FieldLegend>
          <FieldDescription>Isi nol untuk kombinasi yang tidak dipesan. Total roster, jika ada, harus sama per ukuran.</FieldDescription>
          <Table containerClassName="rounded-lg border">
            <TableHeader><TableRow><TableHead>Model</TableHead>{sizeOptions.map((size) => <TableHead key={size.id} className="min-w-24 text-center">{size.name}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{(["PENDEK", "PANJANG"] as const).map((sleeveLength) => (
              <TableRow key={sleeveLength}>
                <TableCell className="font-medium">{sleeveLength === "PENDEK" ? "Pendek" : "Panjang"}</TableCell>
                {sizeOptions.map((size) => {
                  const key = `${sleeveLength}:${size.id}`;
                  return <TableCell key={size.id} className="p-2"><input type="hidden" name="sizeId" value={size.id} /><input type="hidden" name="sleeveLength" value={sleeveLength} /><Input name="sizeQuantity" type="number" min={0} max={10_000_000} step={1} inputMode="numeric" required value={matrix[key] ?? 0} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault(); }} onChange={(event) => updateMatrixValue(key, event.currentTarget.value)} aria-label={`${sleeveLength === "PENDEK" ? "Pendek" : "Panjang"} ukuran ${size.name}`} className="min-w-16 text-center font-mono tabular-nums" /></TableCell>;
                })}
                <TableCell className="text-right font-mono font-medium tabular-nums">{rowTotal(sleeveLength)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </FieldSet>

        <FieldSet>
          <div className="flex items-start justify-between gap-4">
            <div><FieldLegend>Roster pemakai</FieldLegend><FieldDescription>Opsional. Masukkan manual atau unggah XLSX/CSV dengan header ID, Nama, Size.</FieldDescription></div>
            <Button type="button" variant="outline" size="sm" disabled={roster.length >= 5000} onClick={() => setRoster((current) => [...current, { key: `roster-${Date.now()}-${current.length}`, memberId: "", name: "", sizeId: "" }])}><Plus data-icon="inline-start" aria-hidden="true" />Tambah baris</Button>
          </div>
          {roster.length ? <div className="flex flex-col gap-2">{roster.map((row, index) => (
            <div key={row.key} className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_8rem_auto] sm:items-end">
              <Field><FieldLabel htmlFor={`roster-id-${row.key}`} required>ID</FieldLabel><Input id={`roster-id-${row.key}`} name="rosterMemberId" required maxLength={80} value={row.memberId} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, memberId: event.target.value } : item))} /></Field>
              <Field><FieldLabel htmlFor={`roster-name-${row.key}`} required>Nama</FieldLabel><Input id={`roster-name-${row.key}`} name="rosterName" required minLength={2} maxLength={160} value={row.name} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, name: event.target.value } : item))} /></Field>
              <Field><FieldLabel htmlFor={`roster-size-${row.key}`} required>Ukuran</FieldLabel><NativeSelect id={`roster-size-${row.key}`} name="rosterSizeId" required value={row.sizeId} onChange={(event) => setRoster((current) => current.map((item) => item.key === row.key ? { ...item, sizeId: event.target.value } : item))}><NativeSelectOption value="" disabled>Pilih</NativeSelectOption>{sizeOptions.map((size) => <NativeSelectOption key={size.id} value={size.id}>{size.name}</NativeSelectOption>)}</NativeSelect></Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Hapus anggota ${index + 1}`} onClick={() => setRoster((current) => current.filter((item) => item.key !== row.key))}><Trash2 aria-hidden="true" /></Button>
            </div>
          ))}</div> : null}
          <Field><FieldLabel htmlFor={`po-roster-file-${draft?.id ?? "new"}`}>Impor roster</FieldLabel><FilePicker id={`po-roster-file-${draft?.id ?? "new"}`} name="rosterFile" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /><FieldDescription>Maksimal 2 MB dan 5.000 baris. Sheet pertama saja; formula ditolak. File yang dipilih menggantikan roster manual saat disimpan.</FieldDescription></Field>
        </FieldSet>

        <FieldSet>
          <div className="flex items-start justify-between gap-4"><div><FieldLegend>Referensi desain</FieldLegend><FieldDescription>Unggah gambar hasil anotasi final. Maksimal lima file per revisi.</FieldDescription></div><Button type="button" variant="outline" size="sm" disabled={attachmentRows.length >= 5} onClick={() => setAttachmentRows((current) => [...current, { key: `attachment-${Date.now()}-${current.length}`, kind: "OTHER" }])}><Plus data-icon="inline-start" aria-hidden="true" />Tambah file</Button></div>
          {attachmentRows.map((row, index) => <div key={row.key} className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"><Field><FieldLabel htmlFor={`attachment-kind-${row.key}`}>Kategori</FieldLabel><NativeSelect id={`attachment-kind-${row.key}`} name="designAttachmentKind" value={row.kind} onChange={(event) => setAttachmentRows((current) => current.map((item) => item.key === row.key ? { ...item, kind: event.target.value } : item))}>{ATTACHMENT_KINDS.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`attachment-file-${row.key}`}>File {index + 1}</FieldLabel><FilePicker id={`attachment-file-${row.key}`} name="designAttachments" accept="image/jpeg,image/png,image/webp,application/pdf" /></Field><Button type="button" variant="ghost" size="icon" disabled={attachmentRows.length === 1} aria-label={`Hapus slot file ${index + 1}`} onClick={() => setAttachmentRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 aria-hidden="true" /></Button></div>)}
          {draft?.attachmentCount ? <p className="text-xs text-muted-foreground">Dokumen ini sudah memiliki {draft.attachmentCount} lampiran.</p> : null}
        </FieldSet>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`po-design-${draft?.id ?? "new"}`}>Catatan desain</FieldLabel><Textarea id={`po-design-${draft?.id ?? "new"}`} name="designNotes" maxLength={4000} rows={4} defaultValue={draft?.designNotes ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`po-notes-${draft?.id ?? "new"}`}>Catatan lain</FieldLabel><Textarea id={`po-notes-${draft?.id ?? "new"}`} name="notes" maxLength={4000} rows={4} defaultValue={draft?.notes ?? ""} /></Field>
        </div>
        <SubmitButton pendingLabel="Menyimpan PO...">{draft ? "Perbarui draft PO" : "Buat draft PO"}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
