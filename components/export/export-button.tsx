"use client";

import { useState } from "react";

import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { runAnalysisWorkbookExport } from "@/lib/export/run-analysis-workbook";
import { runFinanceWorkbookExport } from "@/lib/export/run-finance-workbook";
import { ExportCancelledError, runExcelExport, type ExportProgress } from "@/lib/export/run-export";
import type { AnalysisWorkbookScope, FinanceWorkbookScope } from "@/lib/export/workbook-types";
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

type ExportTarget =
  | { dataset: string; params: Record<string, string | undefined> }
  | { workbookScope: FinanceWorkbookScope; params: Record<string, string | undefined> }
  | { analysisScope: AnalysisWorkbookScope; params: Record<string, string | undefined> };

async function exportWithToast(target: ExportTarget) {
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
    const onProgress = (progress: ExportProgress) => toast.update(toastId, { description: progressDescription(progress) });
    const result = "workbookScope" in target
      ? await runFinanceWorkbookExport({ scope: target.workbookScope, params: target.params, signal: controller.signal, onProgress })
      : "analysisScope" in target
        ? await runAnalysisWorkbookExport({ scope: target.analysisScope, params: target.params, signal: controller.signal, onProgress })
        : await runExcelExport({ dataset: target.dataset, params: target.params, signal: controller.signal, onProgress });

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
  workbookScope,
  analysisScope,
  params,
  label = "Export Excel",
  size = "default",
  variant = "outline",
  className,
  disabled,
}: SharedProps & { dataset?: string; workbookScope?: FinanceWorkbookScope; analysisScope?: AnalysisWorkbookScope }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    const target: ExportTarget | null = workbookScope
      ? { workbookScope, params: params ?? {} }
      : analysisScope
        ? { analysisScope, params: params ?? {} }
        : dataset
          ? { dataset, params: params ?? {} }
          : null;
    if (!target) return;
    setPending(true);
    try {
      await exportWithToast(target);
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

type ExportMenuItem = {
  dataset?: string;
  workbookScope?: FinanceWorkbookScope;
  analysisScope?: AnalysisWorkbookScope;
  label: string;
  params?: Record<string, string | undefined>;
};

/** Satu tombol untuk beberapa dataset (mis. Customer, Follow-up, Riwayat komunikasi). */
export function ExportMenu({
  items,
  params,
  label = "Export Excel",
  size = "default",
  variant = "outline",
  className,
  disabled,
}: SharedProps & { items: ExportMenuItem[] }) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleSelect(item: ExportMenuItem) {
    if (pendingKey) return;
    const merged = { ...(params ?? {}), ...(item.params ?? {}) };
    const target: ExportTarget | null = item.workbookScope
      ? { workbookScope: item.workbookScope, params: merged }
      : item.analysisScope
        ? { analysisScope: item.analysisScope, params: merged }
        : item.dataset
          ? { dataset: item.dataset, params: merged }
          : null;
    if (!target) return;
    const key = item.workbookScope ?? item.analysisScope ?? item.dataset ?? item.label;
    setPendingKey(key);
    try {
      await exportWithToast(target);
    } finally {
      setPendingKey(null);
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
            disabled={disabled || Boolean(pendingKey)}
            aria-busy={Boolean(pendingKey) || undefined}
          >
            {pendingKey ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Download data-icon="inline-start" aria-hidden="true" />}
            {pendingKey ? "Mengexport…" : label}
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.workbookScope ?? item.analysisScope ?? item.dataset ?? item.label}
            disabled={Boolean(pendingKey)}
            onClick={() => void handleSelect(item)}
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
