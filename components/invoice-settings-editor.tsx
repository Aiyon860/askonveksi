"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

import { InvoiceSettingRichEditor } from "@/components/invoice-setting-rich-editor";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  initialSignatureWidth,
  initialSignatureHeight,
  saveAction,
}: {
  initialPoints: InvoiceSettingPointDraft[];
  initialSignatureWidth: number;
  initialSignatureHeight: number;
  saveAction: InvoiceSettingsSaveAction;
}) {
  const [points, setPoints] = useState<Record<ColumnKey, string[]>>(() => ({
    keterangan: initialPoints.filter((point) => point.section === "KETERANGAN").map((point) => point.text),
    syarat: initialPoints.filter((point) => point.section === "SYARAT_KETENTUAN").map((point) => point.text),
  }));
  const [signatureWidth, setSignatureWidth] = useState(String(initialSignatureWidth));
  const [signatureHeight, setSignatureHeight] = useState(String(initialSignatureHeight));
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  const payload = JSON.stringify({
    keterangan: points.keterangan.map((text) => ({ id: null, text })),
    syarat: points.syarat.map((text) => ({ id: null, text })),
    signatureWidth: Number(signatureWidth),
    signatureHeight: Number(signatureHeight),
  });

  function updatePoints(key: ColumnKey, next: string[]) {
    setPoints((current) => ({ ...current, [key]: next }));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const width = Number(signatureWidth);
    const height = Number(signatureHeight);
    if (!signatureWidth.trim() || !signatureHeight.trim() || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 500 || height > 500) {
      event.preventDefault();
      setError("Ukuran tanda tangan harus berupa angka antara 1 dan 500 pt.");
      return;
    }
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

  async function showPreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const response = await fetch("/api/master-data/invoice-settings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Pratinjau gagal dibuat.");
      }
      const blob = await response.blob();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (cause) {
      setPreviewError(cause instanceof Error ? cause.message : "Pratinjau gagal dibuat.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <form action={saveAction} onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="points" value={payload} />
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <label className="flex flex-wrap items-center gap-2 text-sm">
        Ukuran maksimal tanda tangan (pt)
        <Input
          type="number"
          step="any"
          className="w-24"
          value={signatureWidth}
          onChange={(event) => { setSignatureWidth(event.currentTarget.value); setError(null); }}
          aria-label="Lebar maksimal tanda tangan"
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          step="any"
          className="w-24"
          value={signatureHeight}
          onChange={(event) => { setSignatureHeight(event.currentTarget.value); setError(null); }}
          aria-label="Tinggi maksimal tanda tangan"
        />
        <span className="text-xs text-muted-foreground">Lebar × tinggi; hasil pratinjau menyesuaikan.</span>
      </label>

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
              <p className="text-xs text-muted-foreground">Enter membuat poin baru. Shift+Enter menambah baris dalam poin yang sama. Blok teks lalu pilih ukuran untuk memperbesar bagian itu saja.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground tabular-nums">{points.keterangan.length + points.syarat.length}</strong> poin akan dicetak pada PDF invoice.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={showPreview} disabled={previewing}>
            <Eye data-icon="inline-start" aria-hidden="true" />
            {previewing ? "Membuat pratinjau..." : "Lihat pratinjau PDF"}
          </Button>
          <SubmitButton pendingLabel="Menyimpan pengaturan...">Simpan pengaturan</SubmitButton>
        </div>
      </div>

      {previewError ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {previewError}
        </p>
      ) : null}
      {previewUrl ? (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Pratinjau invoice (data contoh)</p>
            <p className="text-xs text-muted-foreground">Belum disimpan — ubah ukuran teks atau tanda tangan lalu tekan pratinjau lagi.</p>
          </div>
          <iframe src={previewUrl} title="Pratinjau PDF invoice" className="h-[70vh] w-full rounded border bg-white" />
        </div>
      ) : null}
    </form>
  );
}
