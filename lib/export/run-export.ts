import { createXlsxWriter, type WorkbookInit, type XlsxWriter } from "@/lib/export/build-xlsx";
import { downloadFilename } from "@/lib/download-filename";
import { EXPORT_PAGE_SIZE, type ExportPage } from "@/lib/export/types";
import { startExcelWorker, WorkerUnavailableError, type ExcelJob } from "@/lib/export/worker-client";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ExportError extends Error {}

/** Dilempar saat user menekan "Batalkan" di toast export. */
export class ExportCancelledError extends Error {
  constructor() {
    super("Export dibatalkan.");
    this.name = "ExportCancelledError";
  }
}

export type ExportProgress = {
  phase: "fetch" | "build";
  rows: number;
  total: number | null;
  /** 0-100, atau null bila total baris belum diketahui. */
  percent: number | null;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ExportCancelledError();
}

function percentOf(rows: number, total: number | null) {
  if (!total || total <= 0) return null;
  return Math.min(99, Math.round((rows / total) * 100));
}

export type ExportRunResult = {
  rows: number;
  filename: string | null;
};

async function fetchPage(dataset: string, params: URLSearchParams, offset: number, signal?: AbortSignal): Promise<ExportPage> {
  throwIfAborted(signal);
  const url = new URL(`/api/export/${encodeURIComponent(dataset)}`, window.location.origin);
  params.forEach((value, key) => url.searchParams.set(key, value));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(EXPORT_PAGE_SIZE));

  try {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ExportError(payload?.error ?? `Permintaan data gagal (HTTP ${response.status}).`);
    }
    return (await response.json()) as ExportPage;
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new ExportCancelledError();
    throw error;
  }
}

function mainThreadJob(writer: XlsxWriter): ExcelJob {
  return {
    addRows(rows) {
      writer.addRows(rows);
    },
    finish() {
      return writer.finish();
    },
    setProgressHandler() {
      // Progres fallback dihitung di loop export.
    },
    dispose() {
      // Tidak ada resource yang perlu dilepas.
    },
  };
}

function saveBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Beri waktu browser memulai unduhan sebelum blob dilepas.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Semua baris diambil bertahap (offset paging) dan workbook dibangun di Web
 * Worker, jadi jumlah baris tidak dibatasi dan main thread tetap responsif.
 * Bila Worker tidak tersedia, builder berjalan di main thread dengan yield
 * antar-halaman sebagai fallback.
 */
export async function runExcelExport({
  dataset,
  params,
  onProgress,
  signal,
}: {
  dataset: string;
  params: Record<string, string | undefined>;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<ExportRunResult> {
  throwIfAborted(signal);

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const first = await fetchPage(dataset, search, 0, signal);
  if (!first.rows.length) return { rows: 0, filename: null };

  const init: WorkbookInit = {
    sheetName: first.sheetName,
    title: first.title,
    columns: first.columns,
    filterSummary: first.meta.filterSummary,
    notes: first.meta.notes,
  };

  let job: ExcelJob;
  let onMainThread = false;
  try {
    job = await startExcelWorker(init, signal);
  } catch (error) {
    // Abort juga menolak promise ready; jangan pernah fallback setelah dibatalkan.
    throwIfAborted(signal);
    if (!(error instanceof WorkerUnavailableError)) throw error;
    onMainThread = true;
    job = mainThreadJob(await createXlsxWriter(init));
  }

  throwIfAborted(signal);

  let rows = 0;
  job.setProgressHandler((built) =>
    onProgress?.({ phase: "build", rows: built, total: first.total, percent: percentOf(built, first.total) }),
  );

  try {
    let page: ExportPage = first;
    while (true) {
      throwIfAborted(signal);
      job.addRows(page.rows);
      rows += page.rows.length;
      onProgress?.({ phase: onMainThread ? "build" : "fetch", rows, total: first.total, percent: percentOf(rows, first.total) });
      if (onMainThread) await new Promise((resolve) => setTimeout(resolve, 0));
      if (page.nextOffset === null) break;
      page = await fetchPage(dataset, search, page.nextOffset, signal);
      throwIfAborted(signal);
    }

    throwIfAborted(signal);
    const bytes = await job.finish().catch((error: unknown) => {
      throwIfAborted(signal);
      throw error;
    });
    throwIfAborted(signal);
    onProgress?.({ phase: "build", rows, total: first.total, percent: 100 });
    const filename = downloadFilename(first.subject, "xlsx");
    saveBytes(bytes, filename);
    return { rows, filename };
  } finally {
    job.dispose();
  }
}
