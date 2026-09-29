"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type DocumentCancelButtonProps = {
  action: (formData: FormData) => Promise<never>;
  fields: Record<string, string | number>;
  title: string;
  description: string;
  triggerLabel?: string;
  confirmLabel?: string;
};

export function DocumentCancelButton({
  action,
  fields,
  title,
  description,
  triggerLabel = "Batalkan",
  confirmLabel = "Ya, batalkan",
}: DocumentCancelButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <XCircle data-icon="inline-start" aria-hidden="true" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Field>
              <FieldLabel htmlFor="document-cancel-reason" required>Alasan pembatalan</FieldLabel>
              <Textarea
                id="document-cancel-reason"
                name="cancelReason"
                required
                minLength={5}
                maxLength={2000}
                rows={3}
                placeholder="Tuliskan alasan pembatalan..."
              />
              <FieldDescription>Aksi ini dicatat pada audit log beserta pelaku dan waktunya.</FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Kembali</Button>
              <SubmitButton variant="destructive" pendingLabel="Membatalkan...">{confirmLabel}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
