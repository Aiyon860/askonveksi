"use client";

import { useTransition } from "react";

import { toggleHppCompleteAction } from "@/app/actions/finance";
import { Switch } from "@/components/ui/switch";

// Switch Status HPP di kolom Status halaman Project.
// Klik = kirim nilai baru (kebalikan status saat ini) ke server action.
export function HppCompleteSwitch({ salesOrderId, version, checked, disabled = false }: { salesOrderId: string; version: number; checked: boolean; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const next = !checked;
  return <span className="inline-flex flex-col items-start gap-1">
    <Switch
      checked={checked}
      disabled={disabled || pending}
      className="data-checked:bg-emerald-600"
      aria-label={checked ? "Status HPP Lengkap — klik untuk menonaktifkan" : "Status HPP Belum Lengkap — klik untuk melengkapi"}
      onCheckedChange={() => {
        const formData = new FormData();
        formData.set("salesOrderId", salesOrderId);
        formData.set("version", String(version));
        formData.set("hppComplete", String(next));
        startTransition(async () => {
          await toggleHppCompleteAction(formData);
        });
      }}
    />
    <span className={`whitespace-normal text-xs font-medium leading-tight ${checked ? "text-emerald-600" : "text-muted-foreground"}`}>{checked ? "Lengkap" : "Belum Lengkap"}</span>
  </span>;
}
