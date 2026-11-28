"use client";

import { useState } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Tombol "Kosongkan formulir" dengan konfirmasi. Dipakai form PO & invoice saat
 * dokumen berubah total, supaya admin tidak perlu menghapus isian satu per satu.
 * Reset hanya menyentuh isian di layar; server baru berubah saat form disimpan.
 */
export function ClearFormButton({
  onClear,
  title,
  description,
  className,
  confirmLabel = "Ya, kosongkan",
}: {
  onClear: () => void;
  title: string;
  description: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Eraser data-icon="inline-start" aria-hidden="true" />
        Kosongkan formulir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Kembali</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
