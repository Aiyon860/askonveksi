"use client";

import { useEffect, useRef } from "react";

import { FlashMessageClearer } from "@/components/flash-message-clearer";
import { toast } from "@/components/ui/toast";
import type { FlashMessage } from "@/lib/actions/response";

export function FlashMessageAlert({ flash }: { flash: FlashMessage }) {
  const shownId = useRef<string | null>(null);

  useEffect(() => {
    const key = `flash-message-${flash.id}`;
    if (shownId.current === flash.id || sessionStorage.getItem(key)) return;
    shownId.current = flash.id;
    sessionStorage.setItem(key, "shown");
    toast.add({
      title: flash.kind === "error" ? "Tindakan belum berhasil" : flash.kind === "warning" ? "Periksa kembali" : "Berhasil",
      description: flash.message,
      type: flash.kind === "notice" ? "success" : flash.kind,
    });
  }, [flash]);
  return <FlashMessageClearer id={flash.id} />;
}
