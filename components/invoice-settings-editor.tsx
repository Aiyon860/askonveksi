"use client";

import { useState } from "react";

import { InvoiceSettingRichEditor } from "@/components/invoice-setting-rich-editor";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invoicePointPlainText } from "@/lib/crm/invoice-setting-html";

export type InvoiceSettingSection = "KETERANGAN" | "SYARAT_KETENTUAN";

export type InvoiceSettingPointDraft = {
  id: string | null;
  section: InvoiceSettingSection;
  text: string;
};

type ColumnKey = "keterangan" | "syarat";

/** Payload form dikirim sebagai satu string JSON; server memetakan per kolom. */
export type InvoiceSettingsSaveAction = (formData: FormData) => Promise<never>;

const MAX_POINTS_PER_COLUMN = 20;
const MIN_POINT_TEXT = 2;
const MAX_POINT_TEXT = 1000;

const COLUMNS: ReadonlyArray<{
  key: ColumnKey;
  section: InvoiceSettingSection;
  title: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: "keterangan",
    section: "KETERANGAN",
    title: "Keterangan",
    description: "Teks yang dicetak sebagai blok \"Keterangan\" pada PDF invoice. Enter membuat poin baru.",
    placeholder: "Harga sudah termasuk biaya bordir satu titik\nPengiriman maksimal 14 hari kerja",
  },
  {
    key: "syarat",
    section: "SYARAT_KETENTUAN",
    title: "Syarat & Ketentuan",
    description: "Teks yang dicetak sebagai blok \"Syarat & Ketentuan\" tepat di bawah Keterangan. Enter membuat poin baru.",
    placeholder: "Pelunasan maksimal 7 hari setelah barang diterima",
  },
];

export function InvoiceSettingsEditor({
  initialPoints,
  saveAction,
}: {
  initialPoints: InvoiceSettingPointDraft[];
  saveAction: InvoiceSettingsSaveAction;
}) {
  const [points, setPoints] = useState<Record<ColumnKey, string[]>>(() => ({
    keterangan: initialPoints.filter((point) => point.section === "KETERANGAN").map((point) => point.text),
    syarat: initialPoints.filter((point) => point.section === "SYARAT_KETENTUAN").map((point) => point.text),
  }));
  const [error, setError] = useState<string | null>(null);

  const payload = JSON.stringify({
    keterangan: points.keterangan.map((text) => ({ id: null, text })),
    syarat: points.syarat.map((text) => ({ id: null, text })),
  });

  function updatePoints(key: ColumnKey, next: string[]) {
    setPoints((current) => ({ ...current, [key]: next }));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const allPoints = [...points.keterangan, ...points.syarat];
    const tooShort = allPoints.find((html) => invoicePointPlainText(html).length < MIN_POINT_TEXT);
    if (tooShort !== undefined) {
      event.preventDefault();
      setError(`Setiap poin minimal ${MIN_POINT_TEXT} karakter. Perbaiki atau kosongkan poin tersebut sebelum menyimpan.`);
      return;
    }
    const tooLong = allPoints.find((html) => invoicePointPlainText(html).length > MAX_POINT_TEXT);
    if (tooLong !== undefined) {
      event.preventDefault();
      setError(`Setiap poin maksimal ${MAX_POINT_TEXT} karakter.`);
      return;
    }
    if (points.keterangan.length > MAX_POINTS_PER_COLUMN || points.syarat.length > MAX_POINTS_PER_COLUMN) {
      event.preventDefault();
      setError(`Maksimal ${MAX_POINTS_PER_COLUMN} poin per kolom.`);
      return;
    }
    setError(null);
  }

  return (
    <form action={saveAction} onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="points" value={payload} />
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {COLUMNS.map((column) => (
          <Card key={column.key} className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{column.title}</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{points[column.key].length} poin</span>
              </CardTitle>
              <CardDescription>{column.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <InvoiceSettingRichEditor
                label={column.title}
                placeholder={column.placeholder}
                initialPoints={points[column.key]}
                onChange={(next) => updatePoints(column.key, next)}
              />
              <p className="text-xs text-muted-foreground">Enter membuat poin baru. Shift+Enter menambah baris dalam poin yang sama.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground tabular-nums">{points.keterangan.length + points.syarat.length}</strong> poin akan dicetak pada PDF invoice.
        </p>
        <SubmitButton pendingLabel="Menyimpan pengaturan...">Simpan pengaturan</SubmitButton>
      </div>
    </form>
  );
}
