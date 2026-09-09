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
  confirmButtonClassName?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Ya, lanjutkan",
  pendingLabel = "Memproses...",
  confirmButtonClassName,
  variant,
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  const disabled = pending || props.disabled;

  function openConfirmation() {
    const form = triggerRef.current?.form;
    if (!form?.reportValidity()) return;

    setOpen(true);
  }

  function submitConfirmed() {
    const form = triggerRef.current?.form;
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <>
      <Button ref={triggerRef} type="button" variant={variant} {...props} disabled={disabled} onClick={openConfirmation}>
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
            <Button type="button" variant={variant === "destructive" ? "destructive" : "default"} className={confirmButtonClassName} onClick={submitConfirmed}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
