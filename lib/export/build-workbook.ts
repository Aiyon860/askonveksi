import type { Alignment, Cell as ExcelCell, Font, Workbook, Worksheet } from "exceljs";

import type { WorkbookCell, WorkbookCellValue, WorkbookSheet, WorkbookSpec } from "@/lib/export/workbook-types";

const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM_BORDER = { style: "medium" as const, color: { argb: "FF000000" } };
const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 70;

function isFormula(value: WorkbookCellValue): value is { formula: string; result?: string | number | null } {
  return typeof value === "object" && value !== null && "formula" in value;
}

function toExcelValue(value: WorkbookCellValue) {
  if (!isFormula(value)) return value;
  if (value.result === undefined || value.result === null) return { formula: value.formula };
  return { formula: value.formula, result: value.result };
}

function applyCell(target: ExcelCell, source: WorkbookCell) {
  if (source.value !== undefined) target.value = toExcelValue(source.value);

  const font: Partial<Font> = { ...(target.font as Partial<Font>) };
  if (source.bold !== undefined) font.bold = source.bold;
  if (source.italic !== undefined) font.italic = source.italic;
  if (source.size !== undefined) font.size = source.size;
  if (source.color) font.color = { argb: source.color };
  if (Object.keys(font).length) target.font = font;

  if (source.fill) {
    target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: source.fill } };
  }

  const alignment: Partial<Alignment> = { ...(target.alignment as Partial<Alignment>) };
  if (source.align) alignment.horizontal = source.align;
  if (source.vertical) alignment.vertical = source.vertical;
  if (source.wrap !== undefined) alignment.wrapText = source.wrap;
  if (Object.keys(alignment).length) target.alignment = alignment;

  if (source.numFmt) target.numFmt = source.numFmt;

  if (source.border === "thin") {
    target.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
  } else if (source.border === "medium") {
    target.border = { top: MEDIUM_BORDER, left: THIN_BORDER, bottom: MEDIUM_BORDER, right: THIN_BORDER };
  }
}

type MergeRange = { top: number; left: number; bottom: number; right: number };

function columnNumber(letters: string) {
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value;
}

function parseMergeRange(value: string): MergeRange | null {
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(value.trim());
  if (!match) return null;
  const top = Number(match[2]);
  const left = columnNumber(match[1].toUpperCase());
  const bottom = Number(match[4]);
  const right = columnNumber(match[3].toUpperCase());
  if (!Number.isFinite(top) || !Number.isFinite(left) || !Number.isFinite(bottom) || !Number.isFinite(right)) return null;
  return { top, left, bottom, right };
}

function isInsideMerges(ranges: MergeRange[], row: number, column: number) {
  return ranges.some((range) => row >= range.top && row <= range.bottom && column >= range.left && column <= range.right);
}

function longestText(value: string) {
  return value.split(/\r?\n/).reduce((longest, line) => Math.max(longest, line.length), 0);
}

function measureWorkbookValue(value: WorkbookCellValue | undefined) {
  if (value === undefined || value === null) return 0;
  if (isFormula(value)) {
    if (value.result === undefined || value.result === null) return 0;
    return typeof value.result === "number" ? value.result.toLocaleString("id-ID").length : longestText(String(value.result));
  }
  if (typeof value === "number") return value.toLocaleString("id-ID").length;
  return longestText(value);
}

function wrapCell(target: ExcelCell) {
  target.alignment = { ...(target.alignment ?? {}), wrapText: true };
}

/**
 * Lebarkan kolom sesuai isi terpanjang dan bungkus teks yang melebihi batas.
 * Sel yang tergabung (judul/subjudul) dilewati agar tidak melebarkan kolom
 * secara berlebihan.
 */
function autoFitWorkbookSheet(sheet: Worksheet, spec: WorkbookSheet) {
  const ranges = (spec.merges ?? [])
    .map(parseMergeRange)
    .filter((range): range is MergeRange => Boolean(range));

  const measured = spec.columns.map(() => 0);
  spec.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, cellIndex) => {
      if (!cell || cell.value === undefined || cell.value === null || cell.value === "") return;
      if (isInsideMerges(ranges, rowIndex + 1, cellIndex + 1)) return;
      measured[cellIndex] = Math.max(measured[cellIndex] ?? 0, measureWorkbookValue(cell.value));
    });
  });

  const widths = spec.columns.map((column, index) =>
    Math.min(MAX_COLUMN_WIDTH, Math.max(column.width, (measured[index] ?? 0) + 2)),
  );
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  spec.rows.forEach((row, rowIndex) => {
    let lines = 1;
    row.cells.forEach((cell, cellIndex) => {
      if (!cell || typeof cell.value !== "string") return;
      if (isInsideMerges(ranges, rowIndex + 1, cellIndex + 1)) return;
      const available = Math.max(1, (widths[cellIndex] ?? MIN_COLUMN_WIDTH) - 2);
      const cellLines = Math.max(1, Math.ceil(longestText(cell.value) / available));
      lines = Math.max(lines, cellLines);
      if (longestText(cell.value) > available) wrapCell(sheet.getRow(rowIndex + 1).getCell(cellIndex + 1));
    });
    if (lines > 1) {
      const excelRow = sheet.getRow(rowIndex + 1);
      const targetHeight = Math.max(18, lines * 15);
      if (!row.height || targetHeight > row.height) excelRow.height = targetHeight;
    }
  });
}

function applySheet(workbook: Workbook, spec: WorkbookSheet) {
  const sheet = workbook.addWorksheet(spec.name);
  sheet.columns = spec.columns.map((column) => ({ width: column.width }));

  for (const row of spec.rows) {
    const excelRow = sheet.addRow([]);
    if (row.height) excelRow.height = row.height;
    row.cells.forEach((cell, index) => applyCell(excelRow.getCell(index + 1), cell));
  }

  for (const merge of spec.merges ?? []) sheet.mergeCells(merge);

  autoFitWorkbookSheet(sheet, spec);

  if (spec.freeze) {
    sheet.views = [{ state: "frozen", xSplit: spec.freeze.column, ySplit: spec.freeze.row }];
  }
  if (spec.autoFilter) {
    sheet.autoFilter = {
      from: { row: spec.autoFilter.fromRow, column: spec.autoFilter.fromColumn },
      to: { row: spec.autoFilter.toRow, column: spec.autoFilter.toColumn },
    };
  }
  if (spec.pageSetup) {
    sheet.pageSetup = {
      orientation: spec.pageSetup.orientation,
      fitToPage: spec.pageSetup.fitToPage,
      fitToWidth: spec.pageSetup.fitToWidth,
      fitToHeight: spec.pageSetup.fitToHeight,
      paperSize: spec.pageSetup.paperSize,
      margins: spec.pageSetup.margins
        ? {
            left: spec.pageSetup.margins.left ?? 0,
            right: spec.pageSetup.margins.right ?? 0,
            top: spec.pageSetup.margins.top ?? 0,
            bottom: spec.pageSetup.margins.bottom ?? 0,
            header: spec.pageSetup.margins.header ?? 0,
            footer: spec.pageSetup.margins.footer ?? 0,
          }
        : undefined,
      printTitlesRow: spec.pageSetup.printTitlesRow,
    };
  }
  if (spec.properties?.defaultRowHeight) {
    sheet.properties.defaultRowHeight = spec.properties.defaultRowHeight;
  }
}

/** Builder .xlsx untuk spec workbook multi-sheet; dipakai sebagai fallback main thread. */
export async function buildWorkbookSpec(spec: WorkbookSpec): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Askonveksi";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  for (const sheet of spec.sheets) applySheet(workbook, sheet);

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown;
  if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer as ArrayBufferLike);
}
