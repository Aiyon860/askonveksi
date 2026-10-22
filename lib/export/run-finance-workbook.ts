import { downloadFilename } from "@/lib/download-filename";
import { buildWorkbookSpec } from "@/lib/export/build-workbook";
import {
  ExportCancelledError,
  ExportError,
  saveBytes,
  throwIfAborted,
  type ExportProgress,
  type ExportRunResult,
} from "@/lib/export/run-export";
import { startWorkbookWorker, WorkerUnavailableError } from "@/lib/export/worker-client";
import type { FinanceWorkbookScope, WorkbookPayload } from "@/lib/export/workbook-types";

async function fetchWorkbook(
  scope: FinanceWorkbookScope,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<WorkbookPayload> {
  throwIfAborted(signal);
  const url = new URL("/api/export/finance-workbook", window.location.origin);
  url.searchParams.set("scope", scope);
  for (const [key, value] of Object.entries(params)) {
    // Scope ditentukan oleh tombol export, bukan oleh filter halaman.
    if (key !== "scope" && value) url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, { cache: "no-store", signal });
    const payload = (await response.json().catch(() => null)) as
      | ({ error?: string } & Partial<WorkbookPayload>)
      | null;
    if (!response.ok) {
      throw new ExportError(payload?.error ?? `Permintaan data gagal (HTTP ${response.status}).`);
    }
    if (!payload?.spec || typeof payload.rowCount !== "number" || typeof payload.subject !== "string") {
      throw new ExportError("Data export tidak valid.");
    }
    return payload as WorkbookPayload;
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new ExportCancelledError();
    throw error;
  }
}

function percentOf(rows: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(99, Math.round((rows / total) * 100));
}

/**
 * Export laporan keuangan multi-sheet. Server hanya mengirim spec JSON; file
 * .xlsx dibangun di Web Worker agar main thread tetap responsif.
 */
export async function runFinanceWorkbookExport({
  scope,
  params,
  onProgress,
  signal,
}: {
  scope: FinanceWorkbookScope;
  params: Record<string, string | undefined>;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<ExportRunResult> {
  throwIfAborted(signal);
  onProgress?.({ phase: "fetch", rows: 0, total: null, percent: null });
  const payload = await fetchWorkbook(scope, params, signal);
  throwIfAborted(signal);

  if (payload.rowCount === 0) return { rows: 0, filename: null };

  onProgress?.({ phase: "build", rows: 0, total: payload.rowCount, percent: 0 });
  let bytes: Uint8Array;
  try {
    const job = await startWorkbookWorker(payload.spec, signal);
    job.setProgressHandler((rows) => {
      onProgress?.({
        phase: "build",
        rows: Math.min(rows, payload.rowCount),
        total: payload.rowCount,
        percent: percentOf(rows, payload.rowCount),
      });
    });
    try {
      bytes = await job.finish();
    } finally {
      job.dispose();
    }
  } catch (error) {
    throwIfAborted(signal);
    if (!(error instanceof WorkerUnavailableError)) throw error;
    // Fallback main thread: browser lama/CSP tidak bisa membuat worker.
    bytes = await buildWorkbookSpec(payload.spec);
  }

  throwIfAborted(signal);
  onProgress?.({ phase: "build", rows: payload.rowCount, total: payload.rowCount, percent: 100 });
  const filename = downloadFilename(payload.subject, "xlsx");
  saveBytes(bytes, filename);
  return { rows: payload.rowCount, filename };
}
