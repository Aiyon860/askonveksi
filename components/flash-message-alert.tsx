"use client";

import { useState } from "react";
import { CircleCheck, XIcon } from "lucide-react";

import { FlashMessageClearer } from "@/components/flash-message-clearer";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FlashMessage } from "@/lib/actions/response";

export function FlashMessageAlert({ flash }: { flash: FlashMessage }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const isError = flash.kind === "error";

  return (
    <Alert variant={isError ? "destructive" : "success"}>
      <FlashMessageClearer id={flash.id} />
      {!isError ? <CircleCheck aria-hidden="true" /> : null}
      <AlertTitle>{isError ? "Tindakan belum berhasil" : "Berhasil"}</AlertTitle>
      <AlertDescription>{flash.message}</AlertDescription>
      <AlertAction>
        <Button
          aria-label="Tutup pesan"
          onClick={() => setIsVisible(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  );
}
