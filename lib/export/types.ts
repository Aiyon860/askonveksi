/**
 * Kontrak export data — dipakai server (route JSON) dan klien (worker ExcelJS).
 * File .xlsx dibuat 100% di browser; server hanya mengirim baris terformat.
 */
export type ExportColumnFormat = "text" | "number" | "currency" | "percent" | "date" | "datetime";

export type ExportColumn = {
  header: string;
  width?: number;
  format?: ExportColumnFormat;
};

/** Sel JSON-safe: tanggal dikirim "YYYY-MM-DD", tanggal+jam dikirim ISO string. */
export type ExportCell = string | number | null;

export type ExportRow = { cells: ExportCell[]; bold?: boolean };

export type ExportPage = {
  dataset: string;
  title: string;
  /** Nama sheet Excel (maks 31 karakter, tanpa karakter terlarang). */
  sheetName: string;
  /** Subjek nama file (di-slug oleh downloadFilename). */
  subject: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  /** Offset halaman berikutnya; null = data habis. */
  nextOffset: number | null;
  /** Perkiraan total baris (untuk progres), bila murah dihitung. */
  total: number | null;
  meta: {
    filterSummary: string;
    notes: string[];
  };
};

export type ExportDatasetResult = {
  rows: ExportRow[];
  total: number | null;
  filterSummary: string;
  notes?: string[];
};

export const EXPORT_PAGE_SIZE = 1000;
export const EXPORT_MAX_PAGE_SIZE = 2000;
