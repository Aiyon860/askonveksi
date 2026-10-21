"use client";

import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type InvoiceSettingSection = "KETERANGAN" | "SYARAT_KETENTUAN";

export type InvoiceSettingPointDraft = {
  id: string | null;
  section: InvoiceSettingSection;
  text: string;
  bold: boolean;
};

type ColumnKey = "keterangan" | "syarat";

/** Payload form dikirim sebagai satu string JSON; server memetakan per kolom. */
export type InvoiceSettingsSaveAction = (formData: FormData) => Promise<never>;

const MAX_POINTS_PER_COLUMN = 20;

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
    description: "Teks yang dicetak sebagai blok \"Keterangan\" pada PDF invoice. Satu baris = satu poin.",
    placeholder: "Harga sudah termasuk biaya bordir satu titik\nPengiriman maksimal 14 hari kerja",
  },
  {
    key: "syarat",
    section: "SYARAT_KETENTUAN",
    title: "Syarat & Ketentuan",
    description: "Teks yang dicetak sebagai blok \"Syarat & Ketentuan\" tepat di bawah Keterangan. Satu baris = satu poin.",
    placeholder: "Pelunasan maksimal 7 hari setelah barang diterima",
  },
];

/** Satu baris non-kosong = satu poin; baris kosong diabaikan. */
function splitLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

export function InvoiceSettingsEditor({
  initialPoints,
  saveAction,
}: {
  initialPoints: InvoiceSettingPointDraft[];
  saveAction: InvoiceSettingsSaveAction;
}) {
  const [texts, setTexts] = useState<Record<ColumnKey, string>>(() => ({
    keterangan: initialPoints.filter((point) => point.section === "KETERANGAN").map((point) => point.text).join("\n"),
    syarat: initialPoints.filter((point) => point.section === "SYARAT_KETENTUAN").map((point) => point.text).join("\n"),
  }));
  const [error, setError] = useState<string | null>(null);

  // Pertahankan penanda tebal untuk baris yang teksnya tidak berubah.
  const boldByText = useMemo(() => new Map(initialPoints.map((point) => [point.text, point.bold])), [initialPoints]);

  const lines: Record<ColumnKey, string[]> = {
    keterangan: splitLines(texts.keterangan),
    syarat: splitLines(texts.syarat),
  };
  const payload = JSON.stringify({
    keterangan: lines.keterangan.map((text) => ({ id: null, text, bold: boldByText.get(text) ?? false })),
    syarat: lines.syarat.map((text) => ({ id: null, text, bold: boldByText.get(text) ?? false })),
  });

  function updateText(key: ColumnKey, value: string) {
    setTexts((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const tooShort = [...lines.keterangan, ...lines.syarat].find((text) => text.length < 2);
    if (tooShort) {
      event.preventDefault();
      setError("Setiap baris minimal 2 karakter. Perbaiki atau kosongkan baris tersebut sebelum menyimpan.");
      return;
    }
    if (lines.keterangan.length > MAX_POINTS_PER_COLUMN || lines.syarat.length > MAX_POINTS_PER_COLUMN) {
      event.preventDefault();
      setError(`Maksimal ${MAX_POINTS_PER_COLUMN} baris per kolom.`);
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
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{lines[column.key].length} poin</span>
              </CardTitle>
              <CardDescription>{column.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Textarea
                value={texts[column.key]}
                rows={8}
                placeholder={column.placeholder}
                aria-label={column.title}
                className="min-h-40 resize-y"
                onChange={(event) => updateText(column.key, event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Tulis satu poin per baris. Baris kosong diabaikan.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground tabular-nums">{lines.keterangan.length + lines.syarat.length}</strong> poin akan dicetak pada PDF invoice.
        </p>
        <SubmitButton pendingLabel="Menyimpan pengaturan...">Simpan pengaturan</SubmitButton>
      </div>
    </form>
  );
}
