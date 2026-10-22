import type { WorkbookInit } from "@/lib/export/build-xlsx";
import type { ExportRow } from "@/lib/export/types";

/** Worker tidak bisa dibuat (browser lama/CSP) — pemanggil boleh fallback ke main thread. */
export class WorkerUnavailableError extends Error {}

export type ExcelJob = {
  addRows: (rows: ExportRow[]) => void;
  finish: () => Promise<Uint8Array>;
  setProgressHandler: (handler: (rows: number) => void) => void;
  dispose: () => void;
};

const READY_TIMEOUT_MS = 15_000;

/**
 * Satu worker per export: proses berjalan di luar main thread sehingga user
 * tetap bisa scroll/pindah menu. Toast tetap diperbarui dari main thread.
 */
export async function startExcelWorker(init: WorkbookInit, signal?: AbortSignal): Promise<ExcelJob> {
  if (typeof Worker === "undefined") throw new WorkerUnavailableError("Browser tidak mendukung Web Worker.");

  let worker: Worker;
  try {
    // Worker klasik dari /public: Turbopack Next 16.3 menerbitkan worker entry
    // `new Worker(new URL(..., import.meta.url))` sebagai aset mentah (.ts) sehingga
    // gagal dimuat di produksi. Worker ini memuat ExcelJS lewat importScripts.
    worker = new Worker("/export-worker.js");
  } catch {
    throw new WorkerUnavailableError("Web Worker gagal dibuat.");
  }

  let progressHandler: (rows: number) => void = () => {};
  let failure: Error | null = null;
  let readyResolve: (() => void) | null = null;
  let readyReject: ((error: Error) => void) | null = null;
  let finishResolve: ((bytes: Uint8Array) => void) | null = null;
  let finishReject: ((error: Error) => void) | null = null;

  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const timeout = setTimeout(() => {
    readyReject?.(new WorkerUnavailableError("Worker Excel tidak merespons."));
    worker.terminate();
  }, READY_TIMEOUT_MS);

  const cleanup = () => {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  };

  /** Pembatalan user: hentikan worker dan tolak promise yang sedang ditunggu. */
  function onAbort() {
    failure = new WorkerUnavailableError("Export dibatalkan.");
    cleanup();
    readyReject?.(failure);
    finishReject?.(failure);
    readyReject = null;
    finishReject = null;
    worker.terminate();
  }

  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  worker.onmessage = (event: MessageEvent<{ type: string; rows?: number; bytes?: ArrayBuffer; message?: string }>) => {
    const data = event.data;
    if (data.type === "ready") {
      clearTimeout(timeout);
      readyResolve?.();
      return;
    }
    if (data.type === "progress") {
      progressHandler(data.rows ?? 0);
      return;
    }
    if (data.type === "done" && data.bytes) {
      cleanup();
      finishResolve?.(new Uint8Array(data.bytes));
      finishResolve = null;
      finishReject = null;
      worker.terminate();
      return;
    }
    if (data.type === "error") {
      const error = new Error(data.message ?? "Gagal membuat file Excel.");
      failure = error;
      clearTimeout(timeout);
      readyReject?.(new WorkerUnavailableError(error.message));
      finishReject?.(error);
      readyReject = null;
      finishReject = null;
      worker.terminate();
    }
  };

  worker.onerror = () => {
    const error = new WorkerUnavailableError("Worker Excel berhenti sebelum selesai.");
    failure = error;
    cleanup();
    readyReject?.(error);
    finishReject?.(error);
    worker.terminate();
  };

  worker.postMessage({
    type: "init",
    sheetName: init.sheetName,
    title: init.title,
    columns: init.columns,
    filterSummary: init.filterSummary,
    notes: init.notes,
  });

  await ready;

  return {
    addRows(rows) {
      worker.postMessage({ type: "rows", rows });
    },
    finish() {
      if (failure) return Promise.reject(failure);
      return new Promise<Uint8Array>((resolve, reject) => {
        finishResolve = resolve;
        finishReject = reject;
        worker.postMessage({ type: "finish" });
      });
    },
    setProgressHandler(handler) {
      progressHandler = handler;
    },
    dispose() {
      cleanup();
      worker.terminate();
      // Pastikan tidak ada promise yang menggantung bila export dihentikan.
      finishReject?.(new WorkerUnavailableError("Export dihentikan."));
      finishReject = null;
    },
  };
}
