import type { ExportCell, ExportColumn, ExportRow } from "@/lib/export/types";

/**
 * Builder .xlsx murni (tanpa DOM) sehingga bisa dijalankan di Web Worker
 * maupun di main thread sebagai fallback. ExcelJS dimuat dinamis agar tidak
 * masuk bundle awal.
 */
export type WorkbookInit = {
  sheetName: string;
  title: string;
  columns: ExportColumn[];
  filterSummary?: string;
  notes?: string[];
};

export type XlsxWriter = {
  addRows: (rows: ExportRow[]) => number;
  finish: () => Promise<Uint8Array>;
};

const NUMBER_FORMAT = "#,##0";
const DATE_FORMAT = "dd-mm-yyyy";
const DATETIME_FORMAT = "dd-mm-yyyy hh:mm";
const PERCENT_FORMAT = '0.00"%"';

function safeSheetName(value: string) {
  const cleaned = value.replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Data").slice(0, 31);
}

function numberFormat(column: ExportColumn) {
  if (column.format === "currency") return NUMBER_FORMAT;
  if (column.format === "number") return NUMBER_FORMAT;
  if (column.format === "percent") return PERCENT_FORMAT;
  if (column.format === "date") return DATE_FORMAT;
  if (column.format === "datetime") return DATETIME_FORMAT;
  return undefined;
}

function isNumericColumn(column: ExportColumn) {
  return column.format === "currency" || column.format === "number" || column.format === "percent";
}

function toCellValue(column: ExportColumn, value: ExportCell): string | number | Date {
  if (value === null || value === undefined || value === "") return "";
  if (column.format === "date" && typeof value === "string") {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  if (column.format === "datetime" && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  if (isNumericColumn(column)) {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : "";
  }
  return value;
}

export async function createXlsxWriter(init: WorkbookInit): Promise<XlsxWriter> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Askonveksi";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(safeSheetName(init.sheetName));
  sheet.columns = init.columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width ?? 18,
    // Kolom teks dibungkus agar Deskripsi multi-baris (\n) terbaca di Excel.
    style: column.format ? { numFmt: numberFormat(column) } : { alignment: { wrapText: true, vertical: "top" } },
  }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: init.columns.length } };

  const totals = init.columns.map(() => 0);
  let rowCount = 0;

  return {
    addRows(rows) {
      for (const item of rows) {
        const excelRow = sheet.addRow(item.cells.map((cell, index) => {
          const column = init.columns[index];
          return column ? toCellValue(column, cell) : cell;
        }));
        if (item.bold) excelRow.font = { bold: true };
        item.cells.forEach((cell, index) => {
          if (init.columns[index]?.format === "currency" && typeof cell === "number") totals[index] += cell;
        });
        rowCount += 1;
      }
      return rowCount;
    },
    async finish() {
      if (rowCount > 0 && totals.some((value) => value !== 0)) {
        const totalRow = sheet.addRow([]);
        totals.forEach((value, index) => {
          const column = init.columns[index];
          if (column.format === "currency") totalRow.getCell(index + 1).value = value;
          else if (index === 0) totalRow.getCell(1).value = `TOTAL (${rowCount.toLocaleString("id-ID")} baris)`;
        });
        totalRow.font = { bold: true };
      }

      const notes = [
        init.filterSummary ? `Filter: ${init.filterSummary}` : null,
        ...(init.notes ?? []),
        `Dibuat: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())} WIB`,
      ].filter((note): note is string => Boolean(note));
      if (notes.length) {
        sheet.addRow([]);
        for (const note of notes) {
          const noteRow = sheet.addRow([note]);
          noteRow.font = { italic: true, size: 9 };
        }
      }

      const buffer = (await workbook.xlsx.writeBuffer()) as unknown;
      if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
      if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
      return new Uint8Array(buffer as ArrayBufferLike);
    },
  };
}
