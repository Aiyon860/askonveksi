"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PaymentProofPreview({ href, mimeType, label = "Bukti pembayaran" }: { href?: string | null; mimeType?: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  if (!href) return <span className="text-muted-foreground">Belum ada bukti</span>;
  if (mimeType === "application/pdf") return <Button variant="link" size="sm" render={<a href={href} target="_blank" rel="noreferrer" />} nativeButton={false}>Buka bukti PDF</Button>;
  return <><button type="button" className="block size-12 overflow-hidden rounded border focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Perbesar ${label}`} onClick={() => setOpen(true)}><img src={href} alt={label} className="size-full object-cover" /></button>{open ? createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ backgroundColor: "rgb(0 0 0 / 0.7)" }} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><img src={href} alt={label} className="max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] object-contain" /><button type="button" className="absolute top-4 right-4 rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Tutup pratinjau" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>, document.body) : null}</>;
}
