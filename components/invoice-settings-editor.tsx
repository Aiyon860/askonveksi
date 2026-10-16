"use client";

import { ArrowDown, ArrowUp, Bold, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type InvoiceSettingSection = "KETERANGAN" | "SYARAT_KETENTUAN";

export type InvoiceSettingPointDraft = {
  id: string | null;
  section: InvoiceSettingSection;
  text: string;
  bold: boolean;
};

type DraftPoint = InvoiceSettingPointDraft & { key: string };

type ColumnKey = "keterangan" | "syarat";

type DraftState = Record<ColumnKey, DraftPoint[]>;

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
    description: "Poin informasi yang dicetak sebagai blok \"Keterangan\" pada PDF invoice, berurutan dari atas ke bawah.",
    placeholder: "cth. Harga sudah termasuk biaya bordir satu titik",
  },
  {
    key: "syarat",
    section: "SYARAT_KETENTUAN",
    title: "Syarat & Ketentuan",
    description: "Poin aturan yang dicetak sebagai blok \"Syarat & Ketentuan\" tepat di bawah Keterangan pada PDF invoice.",
    placeholder: "cth. Pelunasan maksimal 7 hari setelah barang diterima",
  },
];

/** Payload form dikirim sebagai satu string JSON; server memetakan per kolom. */
export type InvoiceSettingsSaveAction = (formData: FormData) => Promise<never>;

/** Kunci React untuk baris; id database dipakai bila ada, sisanya kunci acak. */
function toDraft(points: InvoiceSettingPointDraft[]): DraftPoint[] {
  return points.map((point) => ({ ...point, key: point.id ?? crypto.randomUUID() }));
}

export function InvoiceSettingsEditor({
  initialPoints,
  saveAction,
}: {
  initialPoints: InvoiceSettingPointDraft[];
  saveAction: InvoiceSettingsSaveAction;
}) {
  const [drafts, setDrafts] = useState<DraftState>(() => ({
    keterangan: toDraft(initialPoints.filter((point) => point.section === "KETERANGAN")),
    syarat: toDraft(initialPoints.filter((point) => point.section === "SYARAT_KETENTUAN")),
  }));
  const [error, setError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const totalPoints = drafts.keterangan.length + drafts.syarat.length;
  const payload = JSON.stringify({
    keterangan: drafts.keterangan.map(({ id, text, bold }) => ({ id, text: text.trim(), bold })),
    syarat: drafts.syarat.map(({ id, text, bold }) => ({ id, text: text.trim(), bold })),
  });

  function updateColumn(key: ColumnKey, update: (points: DraftPoint[]) => DraftPoint[]) {
    setDrafts((current) => ({ ...current, [key]: update(current[key]) }));
    setError(null);
  }

  function addPoint(column: (typeof COLUMNS)[number]) {
    const key = crypto.randomUUID();
    updateColumn(column.key, (points) => [
      ...points,
      { key, id: null, section: column.section, text: "", bold: false },
    ]);
    setFocusKey(key);
  }

  function editPoint(key: ColumnKey, pointKey: string, text: string) {
    updateColumn(key, (points) => points.map((point) => (point.key === pointKey ? { ...point, text } : point)));
  }

  function toggleBold(key: ColumnKey, pointKey: string) {
    updateColumn(key, (points) => points.map((point) => (point.key === pointKey ? { ...point, bold: !point.bold } : point)));
  }

  function removePoint(key: ColumnKey, pointKey: string) {
    updateColumn(key, (points) => points.filter((point) => point.key !== pointKey));
  }

  function movePoint(key: ColumnKey, index: number, direction: -1 | 1) {
    updateColumn(key, (points) => {
      const target = index + direction;
      if (target < 0 || target >= points.length) return points;
      const next = [...points];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const blank = [...drafts.keterangan, ...drafts.syarat].find((point) => point.text.trim().length < 2);
    if (blank) {
      event.preventDefault();
      setError("Setiap poin minimal 2 karakter. Isi teksnya atau hapus poin tersebut sebelum menyimpan.");
      setFocusKey(blank.key);
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
        {COLUMNS.map((column) => {
          const points = drafts[column.key];
          return (
            <Card key={column.key} className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{column.title}</span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">{points.length} poin</span>
                </CardTitle>
                <CardDescription>{column.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {points.length ? (
                  <ol className="flex flex-col gap-2">
                    {points.map((point, index) => (
                      <li key={point.key} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                        <span aria-hidden="true" className="mt-2 w-5 shrink-0 text-center font-mono text-xs text-muted-foreground tabular-nums">
                          {index + 1}
                        </span>
                        <Input
                          value={point.text}
                          maxLength={300}
                          autoFocus={point.key === focusKey}
                          placeholder={column.placeholder}
                          aria-label={`Poin ${column.title} nomor ${index + 1}`}
                          className={cn("flex-1", point.bold && "font-semibold")}
                          onChange={(event) => editPoint(column.key, point.key, event.target.value)}
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={index === 0}
                            aria-label={index === 0 ? "Poin sudah paling atas" : `Naikkan poin ${index + 1}`}
                            title="Naikkan satu urutan"
                            onClick={() => movePoint(column.key, index, -1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={index === points.length - 1}
                            aria-label={index === points.length - 1 ? "Poin sudah paling bawah" : `Turunkan poin ${index + 1}`}
                            title="Turunkan satu urutan"
                            onClick={() => movePoint(column.key, index, 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant={point.bold ? "secondary" : "ghost"}
                            aria-pressed={point.bold}
                            aria-label={`${point.bold ? "Matikan" : "Aktifkan"} huruf tebal poin ${index + 1}`}
                            title={point.bold ? "Huruf tebal aktif" : "Jadikan huruf tebal"}
                            onClick={() => toggleBold(column.key, point.key)}
                          >
                            <Bold aria-hidden="true" className={cn(point.bold && "stroke-[3]")} />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="destructive"
                            aria-label={`Hapus poin ${index + 1}`}
                            title="Hapus poin"
                            onClick={() => removePoint(column.key, point.key)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    Belum ada poin {column.title.toLowerCase()}.
                  </p>
                )}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => addPoint(column)}>
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Tambah poin
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground tabular-nums">{totalPoints}</strong> poin akan dicetak pada PDF invoice. Poin yang ditandai tebal tercetak bold.
        </p>
        <SubmitButton pendingLabel="Menyimpan pengaturan...">Simpan pengaturan</SubmitButton>
      </div>
    </form>
  );
}
