"use client";

import { Copy, Download, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { getInvoiceWhatsAppMessageAction, sendInvoiceWhatsAppAction } from "@/app/actions/whatsapp";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function InvoiceDeliveryActions({ invoiceId, invoiceNo, compact = false }: { invoiceId: string; invoiceNo: string; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [fallbackOpen, setFallbackOpen] = useState(false);

  function copyMessage() {
    startTransition(async () => {
      let text: string;
      try {
        text = await getInvoiceWhatsAppMessageAction(invoiceId);
      } catch {
        toast.add({ title: "Pesan invoice belum dapat disiapkan", type: "error" });
        return;
      }
      setMessage(text);
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard tidak tersedia");
        await navigator.clipboard.writeText(text);
        toast.add({ title: "Pesan invoice disalin", type: "success" });
      } catch {
        setFallbackOpen(true);
      }
    });
  }

  const buttonClass = compact ? undefined : "w-full sm:w-auto";
  return (
    <div className={cn("flex items-center gap-2", !compact && "flex-col sm:flex-row")} onClick={(event) => event.stopPropagation()}>
      <form action={sendInvoiceWhatsAppAction} className={buttonClass}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <SubmitButton size={compact ? "icon" : "default"} variant={compact ? "ghost" : "outline"} pendingLabel={compact ? "" : "Menjadwalkan..."} aria-label={`Kirim ulang ${invoiceNo} melalui WhatsApp`} title="Kirim ulang melalui WhatsApp" className={buttonClass}>
          <MessageCircle aria-hidden="true" />{compact ? null : "Kirim ulang"}
        </SubmitButton>
      </form>
      <Button type="button" size={compact ? "icon" : "default"} variant={compact ? "ghost" : "outline"} onClick={copyMessage} disabled={pending} aria-label={`Salin pesan ${invoiceNo}`} title="Salin pesan invoice" className={buttonClass}>
        <Copy aria-hidden="true" />{compact ? null : "Salin pesan invoice"}
      </Button>
      <Button size={compact ? "icon" : "default"} variant={compact ? "ghost" : "outline"} render={<Link href={`/api/crm/invoice/${invoiceId}/pdf`} />} nativeButton={false} aria-label={`Unduh PDF ${invoiceNo}`} title="Unduh PDF" className={buttonClass}>
        <Download aria-hidden="true" />{compact ? null : "Unduh PDF"}
      </Button>
      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salin pesan invoice</DialogTitle><DialogDescription>Clipboard browser tidak tersedia. Pilih teks berikut lalu salin secara manual.</DialogDescription></DialogHeader>
          <Textarea readOnly value={message} rows={8} onFocus={(event) => event.currentTarget.select()} aria-label="Pesan invoice" />
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
