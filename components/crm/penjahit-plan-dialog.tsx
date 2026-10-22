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

export type PenjahitPlanItem = {
  id: string;
  name: string;
  /** String "YYYY-MM-DD" dari server; null = belum diisi (tampil "-" di PDF penjahit). */
  deadline: string | null;
  hasDesign: boolean;
  designName: string | null;
};

/**
 * Sprint 11 (R3): dialog khusus field penjahit — Deadline Penjahit per item + Upload
 * Desain Penjahit (maks 1 gambar, file baru menimpa). Sengaja bukan form PO penuh
 * (pola E3) supaya data customer tidak tersentuh dan revisi PO tidak terpicu.
 *
 * Field deadline memakai state terkendali (bukan defaultValue) — perubahan default
 * antar render memicu warning Base UI "uncontrolled FieldControl". Form di-remount
 * tiap dialog dibuka (`key={openTick}`) sehingga input file & checkbox ikut ter-reset.
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
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

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
                Isi deadline penjahit tiap produk (berbeda dari deadline customer; kosong tampil &quot;-&quot;) dan unggah desain penjahit — maksimal 1 gambar per produk, file baru menimpa yang lama.
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
                        <div className="flex items-center gap-2">
                          <Input
                            id={`penjahit-design-${item.id}`}
                            className="sr-only"
                            type="file"
                            accept="image/png,image/jpeg"
                            name={`design-${item.id}`}
                            onChange={(event) => {
                              // Tangkap nama file di luar updater setState — event.currentTarget
                              // sudah null saat updater dijalankan ulang oleh React.
                              const fileName = event.currentTarget.files?.[0]?.name ?? "";
                              setFileNames((prev) => ({ ...prev, [item.id]: fileName }));
                            }}
                          />
                          <Button variant="outline" size="sm" render={<label htmlFor={`penjahit-design-${item.id}`} />} nativeButton={false}>
                            <FileUp data-icon="inline-start" aria-hidden="true" />
                            Pilih file
                          </Button>
                          <span className="min-w-0 truncate text-xs text-muted-foreground" title={fileNames[item.id] || undefined}>
                            {fileNames[item.id] || "Belum ada file"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">PNG atau JPG, maksimal 5 MB. File baru menimpa desain lama.</p>
                      </Field>
                    </div>
                    {item.hasDesign ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <a
                          href={`/api/crm/purchase-order/${purchaseOrderId}/items/${item.id}/penjahit-design`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.designName ?? "Lihat desain penjahit"}
                        >
                          <img
                            src={`/api/crm/purchase-order/${purchaseOrderId}/items/${item.id}/penjahit-design`}
                            alt={`Desain penjahit ${item.name}`}
                            className="h-14 w-auto rounded border bg-muted"
                          />
                        </a>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name={`removeDesign-${item.id}`} value="1" />
                          Hapus desain
                        </label>
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
