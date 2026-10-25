"use client";

/* eslint-disable @next/next/no-img-element -- Thumbnail desain penjahit diunggah user & disajikan rute API dinamis; <img> disengaja agar tidak memaksa width/height dan optimasi Next. */
import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Pencil } from "lucide-react";

import { savePenjahitPlanAction } from "@/app/actions/crm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
};

/** Batas gambar desain penjahit per produk — sinkron dengan `PENJAHIT_DESIGN_MAX_PER_ITEM` di action. */
const MAX_DESIGNS_PER_ITEM = 10;
const DESIGN_ACCEPT = "image/png,image/jpeg";

/**
 * Sprint 11 (R3): dialog khusus field penjahit — Deadline Penjahit per item + Upload
 * Desain Penjahit. Revisi: unggahan bisa lebih dari satu gambar per produk; setiap
 * gambar dicetak sebagai satu halaman penuh pada PDF penjahit.
 * Sengaja bukan form PO penuh (pola E3) supaya data customer tidak tersentuh dan
 * revisi PO tidak terpicu.
 *
 * Field deadline memakai state terkendali (bukan defaultValue) — perubahan default
 * antar render memicu warning Base UI "uncontrolled FieldControl". Form di-remount
 * tiap dialog dibuka (`key={openTick}`) sehingga input file & centang hapus ikut ter-reset.
 * Gagal simpan → error inline + dialog tetap terbuka; sukses → tertutup + refresh.
 */
export function PenjahitPlanDialog({
  purchaseOrderId,
  purchaseOrderNo,
  version,
  canEdit,
  items,
}: {
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  version: number;
  canEdit: boolean;
  items: PenjahitPlanItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openTick, setOpenTick] = useState(0);
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});

  const [state, formAction, pending] = useActionState(async (prevState: { error: string | null; success: boolean }, formData: FormData) => {
    // Notifikasi proses: upload desain bisa lama, jadi beri umpan balik toast
    // (tombol submit juga menampilkan spinner) sampai server selesai.
    const toastId = toast.add({
      type: "loading",
      title: "Menyimpan perubahan penjahit…",
      description: "Menunggu deadline dan desain selesai disimpan.",
      timeout: 0,
    });
    try {
      const result = await savePenjahitPlanAction(prevState, formData);
      if (result.success) {
        toast.update(toastId, {
          type: "success",
          title: "Perubahan penjahit tersimpan",
          description: "Deadline dan desain penjahit sudah diperbarui.",
          timeout: 6000,
        });
        // Sukses: tutup dialog + muat ulang data server (deadline & thumbnail ikut segar).
        setOpen(false);
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

  function openDialog() {
    setDeadlines(Object.fromEntries(items.map((item) => [item.id, item.deadline ?? ""])));
    setFileNames({});
    setOpenTick((tick) => tick + 1);
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={!canEdit || undefined}
        title={canEdit ? undefined : "Deadline & desain penjahit hanya dapat diubah selama PO Draft atau Disepakati."}
        onClick={openDialog}
      >
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit PDF Penjahit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{purchaseOrderNo ? `Edit PDF Penjahit ${purchaseOrderNo}` : "Edit PDF Penjahit"}</DialogTitle>
              <DialogDescription>
                Isi deadline penjahit tiap produk (berbeda dari deadline customer; kosong tampil &quot;-&quot;) dan unggah desain penjahit. Satu produk boleh memuat beberapa gambar (maksimal {MAX_DESIGNS_PER_ITEM}), dan setiap gambar dicetak sebagai satu halaman PDF.
              </DialogDescription>
            </DialogHeader>
            <form key={openTick} action={formAction}>
              <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
              <input type="hidden" name="version" value={version} />
              <FieldGroup>
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
                          value={deadlines[item.id] ?? ""}
                          onChange={(event) => setDeadlines((prev) => ({ ...prev, [item.id]: event.target.value }))}
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
                {state.error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Perubahan penjahit belum tersimpan</AlertTitle>
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={pending || items.length === 0}>
                    {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                    {pending ? "Menyimpan..." : "Simpan perubahan"}
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
