"use client";

import { useEffect } from "react";

import { FlashMessageClearer } from "@/components/flash-message-clearer";
import { toast } from "@/components/ui/toast";
import type { FlashMessage } from "@/lib/actions/response";

export function FlashMessageAlert({ flash }: { flash: FlashMessage }) {
  useEffect(() => {
    toast.add({
      title: flash.kind === "error" ? "Tindakan belum berhasil" : flash.kind === "warning" ? "Periksa kembali" : "Berhasil",
      description: flash.message,
      type: flash.kind === "notice" ? "success" : flash.kind,
    });
  }, [flash]);
  return <FlashMessageClearer id={flash.id} />;
}
