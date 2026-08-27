"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type ConfirmSubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "type" | "onClick"> & {
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel?: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Ya, lanjutkan",
  pendingLabel = "Memproses...",
  variant,
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();

  function submitConfirmed() {
    const form = triggerRef.current?.closest("form");
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <>
      <Button ref={triggerRef} type="button" variant={variant} disabled={pending} onClick={() => setOpen(true)} {...props}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? pendingLabel : children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Kembali</Button>
            <Button type="button" variant={variant === "destructive" ? "destructive" : "default"} onClick={submitConfirmed}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
