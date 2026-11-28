"use client";

/* eslint-disable @next/next/no-img-element -- Thumbnail desain penjahit diunggah user & disajikan rute API dinamis; <img> disengaja agar tidak memaksa width/height dan optimasi Next. */
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

import { savePenjahitPlanAction } from "@/app/actions/crm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

export type PenjahitPlanDesign = { id: string; name: string };
export type PenjahitPlanItem = {
  id: string;
  name: string;
  /** String "YYYY-MM-DD" dari server; null = belum diisi (tampil "-" di PDF penjahit). */
  deadline: string | null;
  /** Revisi: satu produk boleh punya beberapa gambar (maks 10); tiap gambar = 1 halaman PDF. */
  designs: PenjahitPlanDesign[];
  /** Sampel per produk — hanya tampil di NOTE PDF penjahit. */
  sampleQty: number;
  sampleSize: string | null;
};

/** Batas gambar desain penjahit per produk — sinkron dengan `PENJAHIT_DESIGN_MAX_PER_ITEM` di action. */
const MAX_DESIGNS_PER_ITEM = 10;
const DESIGN_ACCEPT = "image/png,image/jpeg";

/**
 * Section field penjahit — Deadline Penjahit per item, QTY & ukuran sample, dan desain
 * penjahit. Dipakai di dalam dialog Edit PO supaya semua koreksi pasca-sepakati berada di
 * satu tempat.
 *
 * Semua isian memakai `defaultValue` dari data server (bukan state yang diisi saat tombol
 * diklik), jadi nilai lama selalu tampil apa adanya saat dialog dibuka. Dialog me-remount
 * section ini tiap kali dibuka sehingga input file & centang hapus ikut ter-reset.
 */
export function PenjahitPlanSection({
  purchaseOrderId,
  purchaseOrderNo,
  version,
  items,
  onSaved,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  version: number;
  items: PenjahitPlanItem[];
  /** Dipanggil setelah server menyimpan; dipakai dialog induk untuk menutup diri. */
  onSaved: () => void;
}) {
  const router = useRouter();
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});

  const [state, formAction, pending] = useActionState(async (prevState: { error: string | null; success: boolean }, formData: FormData) => {
    // Notifikasi proses: upload desain bisa lama, jadi beri umpan balik toast
    // (tombol submit juga menampilkan spinner) sampai server selesai.
    const toastId = toast.add({
      type: "loading",
      title: "Menyimpan perubahan penjahit…",
      description: "Menunggu deadline, sampel, dan desain selesai disimpan.",
      timeout: 0,
    });
    try {
      const result = await savePenjahitPlanAction(prevState, formData);
      if (result.success) {
        toast.update(toastId, {
          type: "success",
          title: "Perubahan penjahit tersimpan",
          description: "Deadline, sampel, dan desain penjahit sudah diperbarui.",
          timeout: 6000,
        });
        // Sukses: tutup dialog + muat ulang data server (deadline & thumbnail ikut segar).
        onSaved();
        router.refresh();
      } else {
        toast.update(toastId, {
          type: "error",
          title: "Perubahan penjahit belum tersimpan",
          description: result.error ?? "Coba lagi.",
          timeout: 8000,
        });
      }
      return result;
    } catch (error) {
      toast.update(toastId, {
        type: "error",
        title: "Perubahan penjahit belum tersimpan",
        description: "Terjadi kesalahan saat menyimpan. Coba lagi.",
        timeout: 8000,
      });
      throw error;
    }
  }, { error: null, success: false });

  return (
    <form action={formAction} className="rounded-lg border p-4">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="version" value={version} />
      <FieldGroup>
        <FieldSet>
          <FieldLegend>PDF penjahit</FieldLegend>
          <p className="text-xs text-muted-foreground">
            {purchaseOrderNo ? `Deadline, sampel, dan desain penjahit ${purchaseOrderNo}.` : "Deadline, sampel, dan desain penjahit."} Deadline penjahit
            berbeda dari deadline customer; kosong tampil &quot;-&quot;. Satu produk boleh memuat beberapa gambar (maksimal{" "}
            {MAX_DESIGNS_PER_ITEM}), dan setiap gambar dicetak sebagai satu halaman PDF.
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">PO belum memiliki produk, jadi deadline penjahit belum bisa diisi.</p>
          ) : null}
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">{item.name}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`penjahit-deadline-${item.id}`}>Deadline penjahit</FieldLabel>
                  <Input
                    id={`penjahit-deadline-${item.id}`}
                    name={`deadline-${item.id}`}
                    type="date"
                    defaultValue={item.deadline ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`penjahit-design-${item.id}`}>Desain penjahit</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id={`penjahit-design-${item.id}`}
                      className="sr-only"
                      type="file"
                      multiple
                      accept={DESIGN_ACCEPT}
                      name={`designs-${item.id}`}
                      onChange={(event) => {
                        // Tangkap nama file di luar updater setState — event.currentTarget
                        // sudah null saat updater dijalankan ulang oleh React.
                        const names = Array.from(event.currentTarget.files ?? []).map((file) => file.name);
                        setFileNames((prev) => ({ ...prev, [item.id]: names }));
                      }}
                    />
                    <Button variant="outline" size="sm" render={<label htmlFor={`penjahit-design-${item.id}`} />} nativeButton={false}>
                      <FileUp data-icon="inline-start" aria-hidden="true" />
                      Pilih gambar
                    </Button>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {(fileNames[item.id] ?? []).length
                        ? `${fileNames[item.id].length} gambar dipilih`
                        : `Sisa ${Math.max(0, MAX_DESIGNS_PER_ITEM - item.designs.length)} slot`}
                    </span>
                  </div>
                  {(fileNames[item.id] ?? []).length ? (
                    <ul className="text-xs text-muted-foreground">
                      {fileNames[item.id].map((name, fileIndex) => <li key={`${fileIndex}-${name}`} className="truncate" title={name}>{name}</li>)}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted-foreground">PNG atau JPG, maksimal 5 MB per gambar. Gambar baru ditambahkan, bukan menimpa.</p>
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`penjahit-sample-qty-${item.id}`}>QTY sample</FieldLabel>
                  <Input
                    id={`penjahit-sample-qty-${item.id}`}
                    name={`sampleQty-${item.id}`}
                    type="number"
                    min={1}
                    defaultValue={String(item.sampleQty ?? 1)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`penjahit-sample-size-${item.id}`} required>Ukuran sample</FieldLabel>
                  <Input
                    id={`penjahit-sample-size-${item.id}`}
                    name={`sampleSize-${item.id}`}
                    type="text"
                    required
                    maxLength={40}
                    defaultValue={item.sampleSize ?? ""}
                    placeholder="Mis. M"
                  />
                </Field>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Sampel tampil di NOTE PDF penjahit sebagai &quot;SAMPLE SIZE ... JML ...&quot; dan tidak dicetak di PDF customer.</p>
              {item.designs.length ? (
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  {item.designs.map((design, index) => {
                    // Data lama (sebelum desain multi-gambar) memakai rute tunggal.
                    const src = design.id.startsWith("legacy-")
                      ? `/api/crm/purchase-order/${purchaseOrderId}/items/${item.id}/penjahit-design`
                      : `/api/crm/purchase-order/${purchaseOrderId}/items/${item.id}/penjahit-designs/${design.id}`;
                    return (
                      <div key={design.id} className="flex flex-col items-center gap-1">
                        <a href={src} target="_blank" rel="noopener noreferrer" title={design.name}>
                          <img
                            src={src}
                            alt={`Desain penjahit ${item.name} ${index + 1}`}
                            className="h-14 w-auto rounded border bg-muted"
                          />
                        </a>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" name={`removeDesign-${design.id}`} value="1" />
                          Hapus
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Belum ada desain penjahit untuk produk ini.</p>
              )}
            </div>
          ))}
        </FieldSet>
        {state.error ? (
          <Alert variant="destructive">
            <AlertTitle>Perubahan penjahit belum tersimpan</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || items.length === 0}>
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {pending ? "Menyimpan..." : "Simpan penjahit"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
