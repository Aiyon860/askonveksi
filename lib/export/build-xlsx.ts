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

const HEADER_FILL = "FF1F4E78";
const HEADER_BORDER = { style: "thin" as const, color: { argb: "FF163A5C" } };
const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 70;

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

function isTextColumn(column: ExportColumn) {
  return column.format !== "date" && column.format !== "datetime" && !isNumericColumn(column);
}

function horizontalAlign(column: ExportColumn): "left" | "center" | "right" {
  if (isTextColumn(column)) return "left";
  if (column.format === "date" || column.format === "datetime") return "center";
  return "right";
}

function longestLine(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return 10;
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("id-ID").length : String(value).length;
  const text = String(value);
  let longest = 0;
  for (const line of text.split(/\r?\n/)) longest = Math.max(longest, line.length);
  return longest;
}

function measureCell(column: ExportColumn, value: ExportCell) {
  if (value === null || value === undefined || value === "") return 0;
  if (column.format === "date") return 10;
  if (column.format === "datetime") return 16;
  if (isNumericColumn(column)) {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString("id-ID").length : String(value).length;
  }
  return longestLine(value);
}

function columnWidth(column: ExportColumn, measured: number) {
  const base = column.width ?? 18;
  const desired = measured > 0 ? measured + 2 : 0;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(base, desired, base > 0 ? 0 : MIN_COLUMN_WIDTH));
}

function wrappedLines(value: unknown, width: number) {
  const measured = longestLine(value);
  if (!measured) return 1;
  return Math.max(1, Math.ceil(measured / Math.max(1, width - 2)));
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
    style: {
      numFmt: numberFormat(column),
      alignment: {
        wrapText: isTextColumn(column),
        vertical: "top",
        horizontal: horizontalAlign(column),
      },
    },
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: HEADER_BORDER, left: HEADER_BORDER, bottom: HEADER_BORDER, right: HEADER_BORDER };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const widths = init.columns.map((column) => longestLine(column.header));
  const totals = init.columns.map(() => 0);
  let rowCount = 0;
  let totalRowNumber: number | null = null;

  return {
    addRows(rows) {
      for (const item of rows) {
        const excelRow = sheet.addRow(item.cells.map((cell, index) => {
          const column = init.columns[index];
          return column ? toCellValue(column, cell) : cell;
        }));
        if (item.bold) excelRow.font = { bold: true };
        item.cells.forEach((cell, index) => {
          const column = init.columns[index];
          if (!column) return;
          widths[index] = Math.max(widths[index] ?? 0, measureCell(column, cell));
          if (column.format === "currency" && typeof cell === "number") totals[index] += cell;
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
        totalRowNumber = totalRow.number;
      }
      // Lebar kolom mengikuti isi terpanjang. Teks yang sangat panjang dibungkus
      // agar tetap terbaca tanpa memotong data.
      init.columns.forEach((column, index) => {
        sheet.getColumn(index + 1).width = columnWidth(column, widths[index] ?? 0);
      });

      // Tinggi baris otomatis mengikuti jumlah baris teks yang dibungkus.
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) {
          let headerLines = 1;
          init.columns.forEach((column, index) => {
            const width = sheet.getColumn(index + 1).width ?? MIN_COLUMN_WIDTH;
            headerLines = Math.max(headerLines, wrappedLines(column.header, width));
          });
          row.height = Math.max(30, headerLines * 15);
          return;
        }
        let lines = 1;
        init.columns.forEach((column, index) => {
          if (!isTextColumn(column)) return;
          const width = sheet.getColumn(index + 1).width ?? MIN_COLUMN_WIDTH;
          lines = Math.max(lines, wrappedLines(row.getCell(index + 1).value, width));
        });
        if (lines > 1) row.height = Math.max(row.height ?? 18, lines * 15);
      });

      // AutoFilter mencakup seluruh baris data, bukan hanya header.
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, totalRowNumber ? totalRowNumber - 1 : sheet.rowCount), column: Math.max(1, init.columns.length) },
      };

      const notes = [
        init.filterSummary ? `Filter: ${init.filterSummary}` : null,
        ...(init.notes ?? []),
        `Dibuat: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())} WIB`,
      ].filter((note): note is string => Boolean(note));
      if (notes.length) {
        sheet.addRow([]);
        const noteWidth = init.columns.reduce((sum, _column, index) => sum + (sheet.getColumn(index + 1).width ?? MIN_COLUMN_WIDTH), 0);
        for (const note of notes) {
          const noteRow = sheet.addRow([note]);
          if (init.columns.length > 1) sheet.mergeCells(noteRow.number, 1, noteRow.number, init.columns.length);
          noteRow.font = { italic: true, size: 9 };
          noteRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
          noteRow.height = Math.max(16, Math.ceil(note.length / Math.max(20, noteWidth - 4)) * 15);
        }
      }

      const buffer = (await workbook.xlsx.writeBuffer()) as unknown;
      if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
      if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
      return new Uint8Array(buffer as ArrayBufferLike);
    },
  };
}
