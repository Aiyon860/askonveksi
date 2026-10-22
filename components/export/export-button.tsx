"use client";

import { useState } from "react";

import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { ExportCancelledError, runExcelExport, type ExportProgress } from "@/lib/export/run-export";
import { cn } from "@/lib/utils";

function progressDescription(progress: ExportProgress) {
  const rows = progress.rows.toLocaleString("id-ID");
  const total = progress.total ? progress.total.toLocaleString("id-ID") : null;
  const percent = progress.percent === null ? "" : ` · ${progress.percent}%`;
  if (!total) {
    return progress.phase === "fetch" ? `Memuat ${rows} baris…` : `Menyusun ${rows} baris…`;
  }
  return progress.phase === "fetch"
    ? `Memuat ${rows} dari ${total} baris${percent}`
    : `Menyusun ${rows} dari ${total} baris${percent}`;
}

async function exportWithToast(dataset: string, params: Record<string, string | undefined>) {
  const controller = new AbortController();
  const toastId = toast.add({
    type: "loading",
    title: "Sedang mengexport Excel…",
    description: "Menyiapkan data export · 0%",
    // Loading tidak boleh hilang sendiri; diganti toast success/error saat selesai.
    timeout: 0,
    actionProps: {
      children: "Batalkan",
      onClick: () => controller.abort(),
    },
  });

  try {
    const result = await runExcelExport({
      dataset,
      params,
      signal: controller.signal,
      onProgress: (progress) => toast.update(toastId, { description: progressDescription(progress) }),
    });

    if (!result.rows) {
      toast.update(toastId, {
        type: "warning",
        title: "Tidak ada data untuk diexport",
        description: "Ubah filter terlebih dahulu, lalu coba lagi.",
        timeout: 6000,
        actionProps: {},
      });
      return;
    }

    toast.update(toastId, {
      type: "success",
      title: "Export Excel selesai",
      description: `${result.rows.toLocaleString("id-ID")} baris · ${result.filename}`,
      timeout: 8000,
      actionProps: {},
    });
  } catch (error) {
    if (error instanceof ExportCancelledError || controller.signal.aborted) {
      toast.update(toastId, {
        type: "info",
        title: "Export dibatalkan",
        description: "Tidak ada file yang diunduh. Anda bisa mengexport ulang kapan saja.",
        timeout: 5000,
        actionProps: {},
      });
      return;
    }
    toast.update(toastId, {
      type: "error",
      title: "Export Excel gagal",
      description: error instanceof Error ? error.message : "File gagal dibuat. Coba sekali lagi.",
      timeout: 8000,
      actionProps: {},
    });
  }
}

type SharedProps = {
  params?: Record<string, string | undefined>;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
  className?: string;
  disabled?: boolean;
};

export function ExportButton({
  dataset,
  params,
  label = "Export Excel",
  size = "default",
  variant = "outline",
  className,
  disabled,
}: SharedProps & { dataset: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await exportWithToast(dataset, params ?? {});
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      title={pending ? "Sedang mengexport Excel…" : undefined}
    >
      {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Download data-icon="inline-start" aria-hidden="true" />}
      {pending ? "Mengexport…" : label}
    </Button>
  );
}

/** Satu tombol untuk beberapa dataset (mis. Customer, Follow-up, Riwayat komunikasi). */
export function ExportMenu({
  items,
  params,
  label = "Export Excel",
  size = "default",
  variant = "outline",
  className,
  disabled,
}: SharedProps & { items: Array<{ dataset: string; label: string; params?: Record<string, string | undefined> }> }) {
  const [pendingDataset, setPendingDataset] = useState<string | null>(null);

  async function handleSelect(dataset: string, itemParams?: Record<string, string | undefined>) {
    if (pendingDataset) return;
    setPendingDataset(dataset);
    try {
      await exportWithToast(dataset, { ...(params ?? {}), ...(itemParams ?? {}) });
    } finally {
      setPendingDataset(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={disabled || Boolean(pendingDataset)}
            aria-busy={Boolean(pendingDataset) || undefined}
          >
            {pendingDataset ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Download data-icon="inline-start" aria-hidden="true" />}
            {pendingDataset ? "Mengexport…" : label}
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.dataset}
            disabled={Boolean(pendingDataset)}
            onClick={() => void handleSelect(item.dataset, item.params)}
            className={cn("gap-2")}
          >
            <Download aria-hidden="true" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
