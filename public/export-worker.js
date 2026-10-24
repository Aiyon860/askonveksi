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

var HEADER_FILL = "FF1F4E78";
var HEADER_BORDER = { style: "thin", color: { argb: "FF163A5C" } };
var MIN_COLUMN_WIDTH = 8;
var MAX_COLUMN_WIDTH = 70;

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

function isTextColumn(column) {
  return column.format !== "date" && column.format !== "datetime" && !isNumeric(column);
}

function horizontalAlign(column) {
  if (isTextColumn(column)) return "left";
  if (column.format === "date" || column.format === "datetime") return "center";
  return "right";
}

function longestLine(value) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return 10;
  if (typeof value === "number") return isFinite(value) ? value.toLocaleString("id-ID").length : String(value).length;
  var text = String(value);
  var lines = text.split(/\r?\n/);
  var longest = 0;
  for (var index = 0; index < lines.length; index += 1) {
    if (lines[index].length > longest) longest = lines[index].length;
  }
  return longest;
}

function measureCell(column, value) {
  if (value === null || value === undefined || value === "") return 0;
  if (column.format === "date") return 10;
  if (column.format === "datetime") return 16;
  if (isNumeric(column)) {
    var numeric = typeof value === "number" ? value : Number(value);
    return isFinite(numeric) ? numeric.toLocaleString("id-ID").length : String(value).length;
  }
  return longestLine(value);
}

function columnWidth(column, measured) {
  var base = typeof column.width === "number" ? column.width : 18;
  var desired = measured > 0 ? measured + 2 : 0;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(base, desired, base > 0 ? 0 : MIN_COLUMN_WIDTH));
}

function wrappedLines(value, width) {
  var measured = longestLine(value);
  if (!measured) return 1;
  return Math.max(1, Math.ceil(measured / Math.max(1, width - 2)));
}

function styleGenericHeader(sheet) {
  var header = sheet.getRow(1);
  header.height = 30;
  header.eachCell(function (cell) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: HEADER_BORDER, left: HEADER_BORDER, bottom: HEADER_BORDER, right: HEADER_BORDER };
  });
}

function applyGenericLayout() {
  var sheet = state.sheet;
  for (var index = 0; index < state.columns.length; index += 1) {
    sheet.getColumn(index + 1).width = columnWidth(state.columns[index], state.widths[index]);
  }

  sheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    if (rowNumber === 1) {
      var headerLines = 1;
      for (var headerIndex = 0; headerIndex < state.columns.length; headerIndex += 1) {
        var headerWidth = sheet.getColumn(headerIndex + 1).width || MIN_COLUMN_WIDTH;
        var headerCellLines = wrappedLines(state.columns[headerIndex].header, headerWidth);
        if (headerCellLines > headerLines) headerLines = headerCellLines;
      }
      row.height = Math.max(30, headerLines * 15);
      return;
    }
    var lines = 1;
    for (var cellIndex = 0; cellIndex < state.columns.length; cellIndex += 1) {
      if (!isTextColumn(state.columns[cellIndex])) continue;
      var width = sheet.getColumn(cellIndex + 1).width || MIN_COLUMN_WIDTH;
      var cellLines = wrappedLines(row.getCell(cellIndex + 1).value, width);
      if (cellLines > lines) lines = cellLines;
    }
    if (lines > 1) row.height = Math.max(row.height || 18, lines * 15);
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, state.totalRowNumber ? state.totalRowNumber - 1 : sheet.rowCount), column: Math.max(1, state.columns.length) },
  };
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
    var style = { alignment: { wrapText: isTextColumn(column), vertical: "top", horizontal: horizontalAlign(column) } };
    var numFmt = formatFor(column);
    if (numFmt) style.numFmt = numFmt;
    return { header: column.header, key: column.header, width: column.width || 18, style: style };
  });
  styleGenericHeader(sheet);
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  state = {
    workbook: workbook,
    sheet: sheet,
    columns: message.columns,
    widths: message.columns.map(function (column) { return longestLine(column.header); }),
    totals: message.columns.map(function () { return 0; }),
    rows: 0,
    totalRowNumber: null,
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
      if (!column) continue;
      var measured = measureCell(column, item.cells[cellIndex]);
      if (measured > state.widths[cellIndex]) state.widths[cellIndex] = measured;
      if (column.format === "currency" && typeof item.cells[cellIndex] === "number") {
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
  state.totalRowNumber = row.number;
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
  var noteWidth = 0;
  for (var columnIndex = 0; columnIndex < state.columns.length; columnIndex += 1) {
    noteWidth += state.sheet.getColumn(columnIndex + 1).width || MIN_COLUMN_WIDTH;
  }
  for (var index = 0; index < notes.length; index += 1) {
    var noteRow = state.sheet.addRow([notes[index]]);
    if (state.columns.length > 1) {
      state.sheet.mergeCells(noteRow.number, 1, noteRow.number, state.columns.length);
    }
    noteRow.font = { italic: true, size: 9 };
    noteRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
    noteRow.height = Math.max(16, Math.ceil(notes[index].length / Math.max(20, noteWidth - 4)) * 15);
  }
}

function finish() {
  totalRow();
  applyGenericLayout();
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

function columnNumber(letters) {
  var value = 0;
  for (var index = 0; index < letters.length; index += 1) {
    value = value * 26 + letters.charCodeAt(index) - 64;
  }
  return value;
}

function parseMergeRange(value) {
  var match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(String(value || "").trim());
  if (!match) return null;
  var top = Number(match[2]);
  var left = columnNumber(match[1].toUpperCase());
  var bottom = Number(match[4]);
  var right = columnNumber(match[3].toUpperCase());
  if (!isFinite(top) || !isFinite(left) || !isFinite(bottom) || !isFinite(right)) return null;
  return { top: top, left: left, bottom: bottom, right: right };
}

function isInsideMerges(ranges, row, column) {
  for (var index = 0; index < ranges.length; index += 1) {
    var range = ranges[index];
    if (row >= range.top && row <= range.bottom && column >= range.left && column <= range.right) return true;
  }
  return false;
}

function longestText(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value.toLocaleString("id-ID").length;
  var text = String(value);
  var lines = text.split(/\r?\n/);
  var longest = 0;
  for (var index = 0; index < lines.length; index += 1) {
    if (lines[index].length > longest) longest = lines[index].length;
  }
  return longest;
}

function measureWorkbookValue(value) {
  if (value === undefined || value === null) return 0;
  if (isWorkbookFormula(value)) {
    if (value.result === undefined || value.result === null) return 0;
    return longestText(value.result);
  }
  return longestText(value);
}

function wrapWorkbookCell(cell) {
  var alignment = {};
  if (cell.alignment) {
    for (var key in cell.alignment) {
      if (Object.prototype.hasOwnProperty.call(cell.alignment, key)) alignment[key] = cell.alignment[key];
    }
  }
  alignment.wrapText = true;
  cell.alignment = alignment;
}

function autoFitWorkbookSheet(sheet, sheetSpec) {
  var ranges = [];
  var merges = sheetSpec.merges || [];
  for (var mergeIndex = 0; mergeIndex < merges.length; mergeIndex += 1) {
    var parsed = parseMergeRange(merges[mergeIndex]);
    if (parsed) ranges.push(parsed);
  }

  var measured = sheetSpec.columns.map(function () { return 0; });
  for (var rowIndex = 0; rowIndex < sheetSpec.rows.length; rowIndex += 1) {
    var rowSpec = sheetSpec.rows[rowIndex];
    for (var cellIndex = 0; cellIndex < rowSpec.cells.length; cellIndex += 1) {
      var cell = rowSpec.cells[cellIndex];
      if (!cell || cell.value === undefined || cell.value === null || cell.value === "") continue;
      if (isInsideMerges(ranges, rowIndex + 1, cellIndex + 1)) continue;
      var length = measureWorkbookValue(cell.value);
      if (length > measured[cellIndex]) measured[cellIndex] = length;
    }
  }

  var widths = sheetSpec.columns.map(function (column, index) {
    return Math.min(MAX_COLUMN_WIDTH, Math.max(column.width, measured[index] + 2));
  });
  for (var widthIndex = 0; widthIndex < widths.length; widthIndex += 1) {
    sheet.getColumn(widthIndex + 1).width = widths[widthIndex];
  }

  for (var fitRowIndex = 0; fitRowIndex < sheetSpec.rows.length; fitRowIndex += 1) {
    var fitRow = sheetSpec.rows[fitRowIndex];
    var lines = 1;
    for (var fitCellIndex = 0; fitCellIndex < fitRow.cells.length; fitCellIndex += 1) {
      var fitCell = fitRow.cells[fitCellIndex];
      if (!fitCell || typeof fitCell.value !== "string") continue;
      if (isInsideMerges(ranges, fitRowIndex + 1, fitCellIndex + 1)) continue;
      var available = Math.max(1, (widths[fitCellIndex] || MIN_COLUMN_WIDTH) - 2);
      var cellLines = Math.max(1, Math.ceil(longestText(fitCell.value) / available));
      if (cellLines > lines) lines = cellLines;
      if (longestText(fitCell.value) > available) {
        wrapWorkbookCell(sheet.getRow(fitRowIndex + 1).getCell(fitCellIndex + 1));
      }
    }
    if (lines > 1) {
      var excelRow = sheet.getRow(fitRowIndex + 1);
      var targetHeight = Math.max(18, lines * 15);
      if (!fitRow.height || targetHeight > fitRow.height) excelRow.height = targetHeight;
    }
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

    autoFitWorkbookSheet(sheet, sheetSpec);

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
