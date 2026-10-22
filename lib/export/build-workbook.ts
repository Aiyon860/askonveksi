import type { Alignment, Cell as ExcelCell, Font, Workbook } from "exceljs";

import type { WorkbookCell, WorkbookCellValue, WorkbookSheet, WorkbookSpec } from "@/lib/export/workbook-types";

const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM_BORDER = { style: "medium" as const, color: { argb: "FF000000" } };

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

function applySheet(workbook: Workbook, spec: WorkbookSheet) {
  const sheet = workbook.addWorksheet(spec.name);
  sheet.columns = spec.columns.map((column) => ({ width: column.width }));

  for (const row of spec.rows) {
    const excelRow = sheet.addRow([]);
    if (row.height) excelRow.height = row.height;
    row.cells.forEach((cell, index) => applyCell(excelRow.getCell(index + 1), cell));
  }

  for (const merge of spec.merges ?? []) sheet.mergeCells(merge);

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
