/* global ExcelJS */
/**
 * Web Worker export Excel (klasik, bukan module worker).
 *
 * Next 16.3/Turbopack menerbitkan `new Worker(new URL("./x.ts", import.meta.url))`
 * sebagai aset mentah (`/_next/static/media/x.ts`) sehingga worker gagal dimuat.
 * Karena itu worker ini dilayani apa adanya dari /public dan memuat ExcelJS
 * lewat importScripts. Fallback main-thread tetap tersedia di lib/export/run-export.ts.
 *
 * Protokol: init -> ready, rows -> progress, finish -> done(bytes).
 */
self.importScripts("/vendor/exceljs.min.js");

var NUMBER_FORMAT = "#,##0";
var DATE_FORMAT = "dd-mm-yyyy";
var DATETIME_FORMAT = "dd-mm-yyyy hh:mm";
var PERCENT_FORMAT = '0.00"%"';

var state = null;
var workbookState = null;

function post(message, transfer) {
  if (transfer) self.postMessage(message, transfer);
  else self.postMessage(message);
}

function safeSheetName(value) {
  var cleaned = String(value || "").replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Data").slice(0, 31);
}

function formatFor(column) {
  if (column.format === "currency" || column.format === "number") return NUMBER_FORMAT;
  if (column.format === "percent") return PERCENT_FORMAT;
  if (column.format === "date") return DATE_FORMAT;
  if (column.format === "datetime") return DATETIME_FORMAT;
  return "";
}

function isNumeric(column) {
  return column.format === "currency" || column.format === "number" || column.format === "percent";
}

function toCellValue(column, value) {
  if (value === null || value === undefined || value === "") return "";
  if (column.format === "date" && typeof value === "string") {
    var date = new Date(value + "T00:00:00.000Z");
    return isNaN(date.getTime()) ? value : date;
  }
  if (column.format === "datetime" && typeof value === "string") {
    var instant = new Date(value);
    return isNaN(instant.getTime()) ? value : instant;
  }
  if (isNumeric(column)) {
    var numeric = typeof value === "number" ? value : Number(value);
    return isFinite(numeric) ? numeric : "";
  }
  return value;
}

function init(message) {
  var workbook = new ExcelJS.Workbook();
  workbook.creator = "Askonveksi";
  workbook.created = new Date();

  var sheet = workbook.addWorksheet(safeSheetName(message.sheetName));
  sheet.columns = message.columns.map(function (column) {
    var style = {};
    var numFmt = formatFor(column);
    if (numFmt) style.numFmt = numFmt;
    else style.alignment = { wrapText: true, vertical: "top" };
    return { header: column.header, key: column.header, width: column.width || 18, style: style };
  });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: message.columns.length } };

  state = {
    workbook: workbook,
    sheet: sheet,
    columns: message.columns,
    totals: message.columns.map(function () { return 0; }),
    rows: 0,
    filterSummary: message.filterSummary || "",
    notes: message.notes || [],
  };
}

function addRows(rows) {
  for (var index = 0; index < rows.length; index += 1) {
    var item = rows[index];
    var excelRow = state.sheet.addRow(item.cells.map(function (cell, cellIndex) {
      var column = state.columns[cellIndex];
      return column ? toCellValue(column, cell) : cell;
    }));
    if (item.bold) excelRow.font = { bold: true };
    for (var cellIndex = 0; cellIndex < item.cells.length; cellIndex += 1) {
      var column = state.columns[cellIndex];
      if (column && column.format === "currency" && typeof item.cells[cellIndex] === "number") {
        state.totals[cellIndex] += item.cells[cellIndex];
      }
    }
    state.rows += 1;
  }
  post({ type: "progress", rows: state.rows });
}

function totalRow() {
  var hasTotal = state.totals.some(function (value) { return value !== 0; });
  if (!state.rows || !hasTotal) return;
  var row = state.sheet.addRow([]);
  for (var index = 0; index < state.totals.length; index += 1) {
    if (state.columns[index].format === "currency") row.getCell(index + 1).value = state.totals[index];
    else if (index === 0) row.getCell(1).value = "TOTAL (" + state.rows.toLocaleString("id-ID") + " baris)";
  }
  row.font = { bold: true };
}

function notesRows() {
  var notes = [];
  if (state.filterSummary) notes.push("Filter: " + state.filterSummary);
  notes = notes.concat(state.notes);
  notes.push(
    "Dibuat: " + new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date()) + " WIB",
  );
  state.sheet.addRow([]);
  for (var index = 0; index < notes.length; index += 1) {
    state.sheet.addRow([notes[index]]).font = { italic: true, size: 9 };
  }
}

function finish() {
  totalRow();
  notesRows();
  state.workbook.xlsx.writeBuffer().then(function (buffer) {
    var bytes = buffer instanceof Uint8Array
      ? Uint8Array.from(buffer)
      : buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer);
    state = null;
    post({ type: "done", bytes: bytes.buffer }, [bytes.buffer]);
  }).catch(function (error) {
    state = null;
    post({ type: "error", message: error && error.message ? error.message : "Gagal membuat file Excel." });
  });
}

function isWorkbookFormula(value) {
  return value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "formula");
}

function toWorkbookValue(value) {
  if (!isWorkbookFormula(value)) return value;
  if (value.result === undefined || value.result === null) return { formula: value.formula };
  return { formula: value.formula, result: value.result };
}

function applyWorkbookCell(target, source) {
  if (source.value !== undefined) target.value = toWorkbookValue(source.value);

  var font = {};
  if (target.font) {
    for (var fontKey in target.font) {
      if (Object.prototype.hasOwnProperty.call(target.font, fontKey)) font[fontKey] = target.font[fontKey];
    }
  }
  if (source.bold !== undefined) font.bold = source.bold;
  if (source.italic !== undefined) font.italic = source.italic;
  if (source.size !== undefined) font.size = source.size;
  if (source.color) font.color = { argb: source.color };
  if (Object.keys(font).length) target.font = font;

  if (source.fill) {
    target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: source.fill } };
  }

  var alignment = {};
  if (target.alignment) {
    for (var alignmentKey in target.alignment) {
      if (Object.prototype.hasOwnProperty.call(target.alignment, alignmentKey)) alignment[alignmentKey] = target.alignment[alignmentKey];
    }
  }
  if (source.align) alignment.horizontal = source.align;
  if (source.vertical) alignment.vertical = source.vertical;
  if (source.wrap !== undefined) alignment.wrapText = source.wrap;
  if (Object.keys(alignment).length) target.alignment = alignment;

  if (source.numFmt) target.numFmt = source.numFmt;

  var thin = { style: "thin", color: { argb: "FF000000" } };
  if (source.border === "thin") {
    target.border = { top: thin, left: thin, bottom: thin, right: thin };
  } else if (source.border === "medium") {
    target.border = { top: { style: "medium", color: { argb: "FF000000" } }, left: thin, bottom: { style: "medium", color: { argb: "FF000000" } }, right: thin };
  }
}

function applyWorkbookSpec(workbook, spec) {
  for (var sheetIndex = 0; sheetIndex < spec.sheets.length; sheetIndex += 1) {
    var sheetSpec = spec.sheets[sheetIndex];
    var sheet = workbook.addWorksheet(sheetSpec.name);
    sheet.columns = sheetSpec.columns.map(function (column) { return { width: column.width }; });

    for (var rowIndex = 0; rowIndex < sheetSpec.rows.length; rowIndex += 1) {
      var rowSpec = sheetSpec.rows[rowIndex];
      var excelRow = sheet.addRow([]);
      if (rowSpec.height) excelRow.height = rowSpec.height;
      for (var cellIndex = 0; cellIndex < rowSpec.cells.length; cellIndex += 1) {
        applyWorkbookCell(excelRow.getCell(cellIndex + 1), rowSpec.cells[cellIndex]);
      }
    }

    var merges = sheetSpec.merges || [];
    for (var mergeIndex = 0; mergeIndex < merges.length; mergeIndex += 1) {
      sheet.mergeCells(merges[mergeIndex]);
    }

    if (sheetSpec.freeze) {
      sheet.views = [{ state: "frozen", xSplit: sheetSpec.freeze.column, ySplit: sheetSpec.freeze.row }];
    }
    if (sheetSpec.autoFilter) {
      sheet.autoFilter = {
        from: { row: sheetSpec.autoFilter.fromRow, column: sheetSpec.autoFilter.fromColumn },
        to: { row: sheetSpec.autoFilter.toRow, column: sheetSpec.autoFilter.toColumn },
      };
    }
    if (sheetSpec.pageSetup) {
      sheet.pageSetup = {
        orientation: sheetSpec.pageSetup.orientation,
        fitToPage: sheetSpec.pageSetup.fitToPage,
        fitToWidth: sheetSpec.pageSetup.fitToWidth,
        fitToHeight: sheetSpec.pageSetup.fitToHeight,
        paperSize: sheetSpec.pageSetup.paperSize,
        margins: sheetSpec.pageSetup.margins,
        printTitlesRow: sheetSpec.pageSetup.printTitlesRow,
      };
    }
    if (sheetSpec.properties && sheetSpec.properties.defaultRowHeight) {
      sheet.properties.defaultRowHeight = sheetSpec.properties.defaultRowHeight;
    }
  }
}

function initWorkbook(message) {
  var totalRows = 0;
  for (var index = 0; index < message.spec.sheets.length; index += 1) {
    totalRows += message.spec.sheets[index].rows.length;
  }
  // Siapkan spec saja dulu agar sinyal ready tidak menunggu proses berat.
  workbookState = { spec: message.spec, rows: totalRows, workbook: null };
  post({ type: "ready" });
}

function finishWorkbook() {
  if (!workbookState) throw new Error("Workbook Excel belum siap.");
  post({ type: "progress", rows: workbookState.rows });
  var workbook = new ExcelJS.Workbook();
  workbook.creator = "Askonveksi";
  workbook.created = new Date();
  if (workbook.calcProperties) workbook.calcProperties.fullCalcOnLoad = true;
  applyWorkbookSpec(workbook, workbookState.spec);
  workbookState.workbook = workbook;
  workbookState.workbook.xlsx.writeBuffer().then(function (buffer) {
    var bytes = buffer instanceof Uint8Array
      ? Uint8Array.from(buffer)
      : buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer);
    workbookState = null;
    post({ type: "done", bytes: bytes.buffer }, [bytes.buffer]);
  }).catch(function (error) {
    workbookState = null;
    post({ type: "error", message: error && error.message ? error.message : "Gagal membuat file Excel." });
  });
}

self.onmessage = function (event) {
  try {
    var message = event.data;
    if (message.type === "init-workbook") {
      initWorkbook(message);
      return;
    }
    if (message.type === "finish-workbook") {
      finishWorkbook();
      return;
    }
    if (message.type === "init") {
      init(message);
      post({ type: "ready" });
      return;
    }
    if (!state) throw new Error("Writer Excel belum siap.");
    if (message.type === "rows") {
      addRows(message.rows);
      return;
    }
    if (message.type === "finish") finish();
  } catch (error) {
    post({ type: "error", message: error && error.message ? error.message : "Gagal membuat file Excel." });
  }
};
