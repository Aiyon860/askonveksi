import type { WorkbookCell, WorkbookCellValue, WorkbookPayload, WorkbookRow, WorkbookSheet } from "@/lib/export/workbook-types";
import type { FinanceWorkbookData } from "@/lib/finance/workbook";
import type { WorkbookProject } from "@/lib/finance/expense";

type CellStyle = Omit<WorkbookCell, "value">;

type Grid = { width: number; rows: WorkbookCell[][] };

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const COLORS = {
  blue: "FF0031EA",
  green: "FF92D050",
  red: "FFFF0000",
  orange: "FFFFC000",
  yellow: "FFFFFF00",
  header: "FFD9E1F2",
  subtotal: "FFF2F2F2",
  total: "FFD9D9D9",
  section: "FF1F4E78",
  input: "FFFFF2CC",
  white: "FFFFFFFF",
  text: "FF1F2937",
  muted: "FF6B7280",
} as const;

const CURRENCY = '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-;_-@_-';
const CURRENCY_RED = '_-"Rp"* #,##0_-;[Red]\\-"Rp"* #,##0_-;_-"Rp"* "-"_-;_-@_-';
const PERCENT = "0.00%";

const BASE: CellStyle = { border: "thin", vertical: "middle", wrap: true };
const TITLE_STYLE: CellStyle = {
  fill: COLORS.blue,
  color: COLORS.white,
  bold: true,
  size: 16,
  align: "center",
  vertical: "middle",
  border: "thin",
};
const SUBTITLE_STYLE: CellStyle = {
  fill: COLORS.blue,
  color: COLORS.white,
  italic: true,
  size: 10,
  align: "center",
  vertical: "middle",
  border: "thin",
};
const HEADER_STYLE: CellStyle = { ...BASE, fill: COLORS.header, bold: true, align: "center" };
const TOTAL_STYLE: CellStyle = { ...BASE, fill: COLORS.total, bold: true };
const SECTION_STYLE: CellStyle = { ...BASE, fill: COLORS.section, color: COLORS.white, bold: true };

const PROJECT_WIDTHS = [5, 28, 18, 7, 13, 11, 11, 11, 14, 11, 11, 14, 16, 14, 9, 20, 14, 26, 13, 15, 15, 16, 15];
const EXPENSE_WIDTHS = [24, 42, 34, 22, 14, 16, 18, 8, 20, 20, 36];
const PURE_WIDTHS = [24, 42, 16, 22, 3, 30, 16];
const CASH_WIDTHS = [26, 48, 16, 16, 16, 20, 22];
const NOTES_WIDTHS = [34, 16, 3, 34, 16];

const LANDSCAPE_PAGE = {
  orientation: "landscape" as const,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  paperSize: 9,
  margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
};
const PORTRAIT_PAGE = { ...LANDSCAPE_PAGE, orientation: "portrait" as const };

function cell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return { ...style, value };
}

function blank(style: CellStyle = {}): WorkbookCell {
  return { ...style, value: null };
}

function fullRow(width: number, value: WorkbookCellValue, style: CellStyle): WorkbookCell[] {
  return Array.from({ length: width }, (_, index) => cell(index === 0 ? value : null, style));
}

function blankRow(width: number, style: CellStyle = {}): WorkbookCell[] {
  return Array.from({ length: width }, () => blank(style));
}

function headerCell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return cell(value, { ...HEADER_STYLE, ...style });
}

function dataCell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return cell(value, { ...BASE, align: "left", ...style });
}

function centerCell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return cell(value, { ...BASE, align: "center", ...style });
}

function moneyCell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return cell(value, { ...BASE, align: "right", numFmt: CURRENCY, ...style });
}

function percentCell(value: WorkbookCellValue, style: CellStyle = {}): WorkbookCell {
  return cell(value, { ...BASE, align: "right", numFmt: PERCENT, ...style });
}

function blankZero(value: number) {
  return value === 0 ? null : value;
}

function sumFormula(column: string, firstRow: number, lastRow: number, result: number): WorkbookCellValue {
  return lastRow < firstRow ? result : { formula: `SUM(${column}${firstRow}:${column}${lastRow})`, result };
}

function columnLetter(index: number) {
  let value = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS_ID[month - 1]} ${year}`;
}

function dayDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return `${DAYS_ID[date.getUTCDay()]}, ${dateLabel(value)}`;
}

function addNotes(rows: WorkbookRow[], merges: string[], width: number, notes: string[]) {
  const noteStyle: CellStyle = { italic: true, size: 9, color: COLORS.muted, wrap: true, vertical: "middle" };
  rows.push({ cells: blankRow(width), height: 8 });
  let row = rows.length + 1;
  for (const note of notes) {
    rows.push({ cells: fullRow(width, note, noteStyle), height: 18 });
    merges.push(`A${row}:${columnLetter(width)}${row}`);
    row += 1;
  }
}

function createGrid(width: number): Grid {
  return { width, rows: [] };
}

function ensureGridRow(grid: Grid, rowNumber: number) {
  while (grid.rows.length < rowNumber) {
    grid.rows.push(blankRow(grid.width));
  }
  return grid.rows[rowNumber - 1];
}

function setGridRow(grid: Grid, rowNumber: number, cells: Array<{ column: number; cell: WorkbookCell }>) {
  const row = ensureGridRow(grid, rowNumber);
  for (const item of cells) row[item.column] = item.cell;
}

function gridToRows(grid: Grid): WorkbookRow[] {
  return grid.rows.map((cells) => ({ cells, height: 20 }));
}

function groupByDate<T extends { spentAt: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.spentAt) ?? [];
    group.push(item);
    groups.set(item.spentAt, group);
  }
  return groups;
}

function sumAmounts<T>(items: T[], amount: (item: T) => number) {
  return items.reduce((sum, item) => sum + amount(item), 0);
}

function projectTotals(projects: WorkbookProject[]) {
  return {
    quantity: projects.reduce((sum, project) => sum + project.quantity, 0),
    components: [
      projects.reduce((sum, project) => sum + project.kain, 0),
      projects.reduce((sum, project) => sum + project.zipper, 0),
      projects.reduce((sum, project) => sum + project.jahit, 0),
      projects.reduce((sum, project) => sum + project.pres, 0),
      projects.reduce((sum, project) => sum + project.dtfPlastisol, 0),
      projects.reduce((sum, project) => sum + project.bordir, 0),
      projects.reduce((sum, project) => sum + project.lainnya, 0),
    ],
    totalHpp: projects.reduce((sum, project) => sum + project.totalHpp, 0),
    totalInvoice: projects.reduce((sum, project) => sum + project.totalInvoice, 0),
    totalNetProfit: projects.reduce((sum, project) => sum + (project.netProfit ?? 0), 0),
    completeInvoice: projects.filter((project) => project.hppComplete).reduce((sum, project) => sum + project.totalInvoice, 0),
    totalDeposit: projects.reduce((sum, project) => sum + project.deposit, 0),
    totalDp: projects.reduce((sum, project) => sum + project.dp, 0),
    totalSettled: projects.reduce((sum, project) => sum + project.settled, 0),
    totalPaid: projects.reduce((sum, project) => sum + project.paid, 0),
    totalRemaining: projects.reduce((sum, project) => sum + project.remaining, 0),
    totalPeriodPaid: projects.reduce((sum, project) => sum + project.periodPaid, 0),
  };
}

function buildProjectLikeSheet(data: FinanceWorkbookData, mode: "project" | "dp") {
  const width = 23;
  const rows: WorkbookRow[] = [];
  const merges: string[] = [];
  if (mode === "project") {
    rows.push({ cells: fullRow(width, `LAPORAN PROJECT ASKONVEKSI ${data.period.monthLabel}`, TITLE_STYLE), height: 36 });
    merges.push("A1:W1");
    rows.push({ cells: fullRow(width, `Tanggal ${data.period.rangeLabel}`, SUBTITLE_STYLE), height: 22 });
    merges.push("A2:W2");
  }
  const groupRow = rows.length + 1;
  const firstHeaderNumber = groupRow + 1;
  const secondHeaderNumber = groupRow + 2;

  const group = blankRow(width, HEADER_STYLE);
  group[0] = headerCell("PEMASUKAN");
  group[4] = headerCell("HPP");
  group[11] = headerCell("TOTAL HPP");
  if (mode === "project") {
    group[12] = headerCell("TOTAL INVOICE", { fill: COLORS.green });
    group[13] = headerCell("LABA BERSIH", { fill: COLORS.red, color: COLORS.white });
    group[14] = headerCell("MARGIN");
    group[15] = headerCell("DATA SISTEM");
    merges.push(
      `A${groupRow}:D${groupRow}`,
      `E${groupRow}:K${groupRow}`,
      `L${groupRow}:L${secondHeaderNumber}`,
      `M${groupRow}:M${secondHeaderNumber}`,
      `N${groupRow}:N${secondHeaderNumber}`,
      `O${groupRow}:O${secondHeaderNumber}`,
      `P${groupRow}:W${firstHeaderNumber}`,
    );
  } else {
    group[12] = headerCell("DEPOSIT");
    group[13] = headerCell("DP");
    group[14] = headerCell("PELUNASAN");
    group[15] = headerCell("TOTAL DIBAYAR");
    group[16] = headerCell("SISA TAGIHAN", { fill: COLORS.red, color: COLORS.white });
    group[17] = headerCell("TOTAL INVOICE", { fill: COLORS.green });
    group[18] = headerCell("DATA SISTEM");
    merges.push(
      `A${groupRow}:D${groupRow}`,
      `E${groupRow}:K${groupRow}`,
      `L${groupRow}:L${secondHeaderNumber}`,
      `M${groupRow}:M${secondHeaderNumber}`,
      `N${groupRow}:N${secondHeaderNumber}`,
      `O${groupRow}:O${secondHeaderNumber}`,
      `P${groupRow}:P${secondHeaderNumber}`,
      `Q${groupRow}:Q${secondHeaderNumber}`,
      `R${groupRow}:R${secondHeaderNumber}`,
      `S${groupRow}:W${firstHeaderNumber}`,
    );
  }
  rows.push({ cells: group, height: 24 });

  const firstHeaderRow = blankRow(width, HEADER_STYLE);
  const secondHeaderRow = blankRow(width, HEADER_STYLE);
  const firstLabels: Array<[number, string]> = [
    [0, "NO."],
    [1, "NAMA ORDER"],
    [2, "JENIS"],
    [3, "JML"],
    [4, "BAHAN"],
    [7, "PRES"],
    [8, "DTF / PLASTISOL"],
    [9, "BORDIR"],
    [10, "LAIN LAIN"],
  ];
  const secondLabels: Array<[number, string]> = [
    [4, "KAIN"],
    [5, "ZIPPER"],
    [6, "JAHIT"],
  ];
  if (mode === "project") {
    secondLabels.push(
      [15, "NO. INVOICE"],
      [16, "TANGGAL ORDER"],
      [17, "PRODUK"],
      [18, "STATUS BAYAR"],
      [19, "SISA TAGIHAN"],
      [20, "STATUS HPP"],
      [21, "PEMBAYARAN PERIODE"],
      [22, "TANGGAL BAYAR TERAKHIR"],
    );
    merges.push(
      `A${firstHeaderNumber}:A${secondHeaderNumber}`,
      `B${firstHeaderNumber}:B${secondHeaderNumber}`,
      `C${firstHeaderNumber}:C${secondHeaderNumber}`,
      `D${firstHeaderNumber}:D${secondHeaderNumber}`,
      `E${firstHeaderNumber}:G${firstHeaderNumber}`,
      `H${firstHeaderNumber}:H${secondHeaderNumber}`,
      `I${firstHeaderNumber}:I${secondHeaderNumber}`,
      `J${firstHeaderNumber}:J${secondHeaderNumber}`,
      `K${firstHeaderNumber}:K${secondHeaderNumber}`,
    );
  } else {
    secondLabels.push(
      [18, "NO. INVOICE"],
      [19, "PRODUK"],
      [20, "STATUS BAYAR"],
      [21, "PEMBAYARAN PERIODE"],
      [22, "TANGGAL BAYAR TERAKHIR"],
    );
    merges.push(
      `A${firstHeaderNumber}:A${secondHeaderNumber}`,
      `B${firstHeaderNumber}:B${secondHeaderNumber}`,
      `C${firstHeaderNumber}:C${secondHeaderNumber}`,
      `D${firstHeaderNumber}:D${secondHeaderNumber}`,
      `E${firstHeaderNumber}:G${firstHeaderNumber}`,
      `H${firstHeaderNumber}:H${secondHeaderNumber}`,
      `I${firstHeaderNumber}:I${secondHeaderNumber}`,
      `J${firstHeaderNumber}:J${secondHeaderNumber}`,
      `K${firstHeaderNumber}:K${secondHeaderNumber}`,
    );
  }
  for (const [column, value] of firstLabels) firstHeaderRow[column] = headerCell(value);
  for (const [column, value] of secondLabels) secondHeaderRow[column] = headerCell(value);
  rows.push({ cells: firstHeaderRow, height: 28 });
  rows.push({ cells: secondHeaderRow, height: 28 });

  const firstDataRow = rows.length + 1;
  data.projects.forEach((project, index) => {
    const rowNumber = rows.length + 1;
    const cells: WorkbookCell[] = [
      centerCell(index + 1),
      dataCell(project.customer),
      dataCell(project.garmentType),
      centerCell(project.quantity),
      moneyCell(blankZero(project.kain)),
      moneyCell(blankZero(project.zipper)),
      moneyCell(blankZero(project.jahit)),
      moneyCell(blankZero(project.pres)),
      moneyCell(blankZero(project.dtfPlastisol)),
      moneyCell(blankZero(project.bordir)),
      moneyCell(blankZero(project.lainnya)),
      moneyCell({ formula: `SUM(E${rowNumber}:K${rowNumber})`, result: project.totalHpp }),
    ];
    if (mode === "project") {
      cells.push(
        moneyCell(project.totalInvoice),
        project.netProfit === null
          ? moneyCell(null)
          : moneyCell({ formula: `IF(U${rowNumber}="Lengkap",M${rowNumber}-L${rowNumber},"")`, result: project.netProfit }, { numFmt: CURRENCY_RED }),
        project.margin === null
          ? percentCell(null)
          : percentCell({ formula: `IF(N${rowNumber}="","",N${rowNumber}/M${rowNumber})`, result: project.margin }),
        dataCell(project.invoiceNo),
        centerCell(project.acceptedAt ? dateLabel(project.acceptedAt) : "-"),
        dataCell(project.productName),
        centerCell(project.statusBayar),
        moneyCell(blankZero(project.remaining), { numFmt: CURRENCY_RED }),
        centerCell(project.hppComplete ? "Lengkap" : "Belum lengkap"),
        moneyCell(blankZero(project.periodPaid)),
        centerCell(project.latestPaidAt ? dateLabel(project.latestPaidAt) : "-"),
      );
    } else {
      cells.push(
        moneyCell(blankZero(project.deposit)),
        moneyCell(blankZero(project.dp)),
        moneyCell(blankZero(project.settled)),
        moneyCell(project.paid),
        moneyCell({ formula: `MAX(R${rowNumber}-P${rowNumber},0)`, result: project.remaining }, { numFmt: CURRENCY_RED }),
        moneyCell(project.totalInvoice),
        dataCell(project.invoiceNo),
        dataCell(project.productName),
        centerCell(project.statusBayar),
        moneyCell(blankZero(project.periodPaid)),
        centerCell(project.latestPaidAt ? dateLabel(project.latestPaidAt) : "-"),
      );
    }
    rows.push({ cells, height: 20 });
  });
  const lastDataRow = rows.length;

  const totals = projectTotals(data.projects);
  const totalRow = rows.length + 1;
  const totalCells = blankRow(width, TOTAL_STYLE);
  totalCells[0] = cell("TOTAL", { ...TOTAL_STYLE, align: "center" });
  totalCells[3] = centerCell(sumFormula("D", firstDataRow, lastDataRow, totals.quantity), TOTAL_STYLE);
  totals.components.forEach((value, index) => {
    totalCells[4 + index] = moneyCell(sumFormula(columnLetter(5 + index), firstDataRow, lastDataRow, value), TOTAL_STYLE);
  });
  totalCells[11] = moneyCell(sumFormula("L", firstDataRow, lastDataRow, totals.totalHpp), TOTAL_STYLE);
  if (mode === "project") {
    totalCells[12] = moneyCell(sumFormula("M", firstDataRow, lastDataRow, totals.totalInvoice), TOTAL_STYLE);
    totalCells[13] = moneyCell(sumFormula("N", firstDataRow, lastDataRow, totals.totalNetProfit), { ...TOTAL_STYLE, numFmt: CURRENCY_RED });
    const completeRange = `U${firstDataRow}:U${lastDataRow}`;
    const invoiceRange = `M${firstDataRow}:M${lastDataRow}`;
    totalCells[14] = lastDataRow >= firstDataRow
      ? percentCell({
          formula: `IF(SUMIF(${completeRange},"Lengkap",${invoiceRange})=0,"",N${totalRow}/SUMIF(${completeRange},"Lengkap",${invoiceRange}))`,
          result: totals.completeInvoice === 0 ? "" : totals.totalNetProfit / totals.completeInvoice,
        }, TOTAL_STYLE)
      : percentCell(null, TOTAL_STYLE);
    totalCells[19] = moneyCell(sumFormula("T", firstDataRow, lastDataRow, totals.totalRemaining), { ...TOTAL_STYLE, numFmt: CURRENCY_RED });
    totalCells[21] = moneyCell(sumFormula("V", firstDataRow, lastDataRow, totals.totalPeriodPaid), TOTAL_STYLE);
  } else {
    totalCells[12] = moneyCell(sumFormula("M", firstDataRow, lastDataRow, totals.totalDeposit), TOTAL_STYLE);
    totalCells[13] = moneyCell(sumFormula("N", firstDataRow, lastDataRow, totals.totalDp), TOTAL_STYLE);
    totalCells[14] = moneyCell(sumFormula("O", firstDataRow, lastDataRow, totals.totalSettled), TOTAL_STYLE);
    totalCells[15] = moneyCell(sumFormula("P", firstDataRow, lastDataRow, totals.totalPaid), TOTAL_STYLE);
    totalCells[16] = moneyCell(sumFormula("Q", firstDataRow, lastDataRow, totals.totalRemaining), { ...TOTAL_STYLE, numFmt: CURRENCY_RED });
    totalCells[17] = moneyCell(sumFormula("R", firstDataRow, lastDataRow, totals.totalInvoice), TOTAL_STYLE);
    totalCells[21] = moneyCell(sumFormula("V", firstDataRow, lastDataRow, totals.totalPeriodPaid), TOTAL_STYLE);
  }
  rows.push({ cells: totalCells, height: 22 });

  const notes = mode === "project"
    ? [
        "Daftar project mencakup semua project aktif dengan invoice terbit; tanggal export hanya membatasi kolom Pembayaran Periode.",
        "HPP dihitung dari jumlah komponen yang tercatat. Laba dan margin hanya dihitung untuk project dengan status HPP Lengkap.",
        "Pembayaran Periode hanya menghitung transaksi di dalam rentang tanggal export.",
        `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
      ]
    : [
        "Daftar project mencakup semua project aktif dengan invoice terbit; tanggal export hanya membatasi kolom Pembayaran Periode.",
        `Deposit, DP, dan Pelunasan adalah total sampai tanggal export. Pembayaran Periode (${data.period.rangeLabel}) hanya transaksi di dalam periode.`,
        "Sisa Tagihan = Total Invoice - Total Dibayar (tidak pernah negatif). Total Dibayar diambil dari seluruh transaksi pembayaran aktif.",
        `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
      ];
  addNotes(rows, merges, width, notes);

  return {
    sheet: {
      name: mode === "project" ? "PROJECT" : "DP",
      columns: PROJECT_WIDTHS.map((columnWidth) => ({ width: columnWidth })),
      rows,
      merges,
      freeze: { row: secondHeaderNumber, column: 2 },
      pageSetup: { ...LANDSCAPE_PAGE, printTitlesRow: `${groupRow}:${secondHeaderNumber}` },
      properties: { defaultRowHeight: 20 },
    } satisfies WorkbookSheet,
    totalRow,
  };
}

function buildExpenseSheet(data: FinanceWorkbookData) {
  const width = 11;
  const rows: WorkbookRow[] = [];
  const merges: string[] = [];
  rows.push({ cells: fullRow(width, `BEBAN BULANAN ASKONVEKSI ${data.period.rangeLabel}`, TITLE_STYLE), height: 36 });
  merges.push("A1:K1");
  const headers = ["TANGGAL", "PENGELUARAN", "CUSTOMER / PROJECT", "KATEGORI", "JENIS", "TOTAL", "METODE", "BUKTI", "DICATAT OLEH", "REFERENSI", "DESKRIPSI"];
  rows.push({ cells: headers.map((header) => headerCell(header, { fill: COLORS.yellow })), height: 28 });

  const groups = groupByDate(data.expenses);
  const dataRanges: string[] = [];
  for (const [date, items] of groups) {
    const groupStart = rows.length + 1;
    items.forEach((item, index) => {
      rows.push({
        cells: [
          centerCell(index === 0 ? dayDateLabel(date) : null),
          dataCell(item.purpose),
          dataCell(item.customerProject),
          dataCell(item.categoryLabel),
          centerCell(item.kind === "PROJECT" ? "Project" : "Operasional"),
          moneyCell(item.amount),
          dataCell(item.method),
          centerCell(item.proof),
          dataCell(item.createdBy),
          dataCell(item.reference),
          dataCell(item.description || "-"),
        ],
        height: 20,
      });
    });
    const groupEnd = rows.length;
    if (groupEnd > groupStart) merges.push(`A${groupStart}:A${groupEnd}`);
    dataRanges.push(`F${groupStart}:F${groupEnd}`);
    const subtotal = sumAmounts(items, (item) => item.amount);
    const subtotalCells = blankRow(width, { ...BASE, fill: COLORS.subtotal, bold: true });
    subtotalCells[1] = cell(`Subtotal ${dayDateLabel(date)}`, { ...BASE, fill: COLORS.subtotal, bold: true, align: "left" });
    subtotalCells[5] = moneyCell({ formula: `SUM(F${groupStart}:F${groupEnd})`, result: subtotal }, { ...BASE, fill: COLORS.subtotal, bold: true });
    rows.push({ cells: subtotalCells, height: 20 });
  }

  const totalCells = blankRow(width, TOTAL_STYLE);
  totalCells[1] = cell("TOTAL PENGELUARAN", { ...TOTAL_STYLE, align: "left" });
  totalCells[5] = moneyCell(
    dataRanges.length
      ? { formula: `SUM(${dataRanges.join(",")})`, result: sumAmounts(data.expenses, (item) => item.amount) }
      : 0,
    TOTAL_STYLE,
  );
  rows.push({ cells: totalCells, height: 24 });

  addNotes(rows, merges, width, [
    "Total dihitung dari baris pengeluaran; baris subtotal tidak ikut dijumlahkan.",
    "Pengeluaran project dan operasional dipisahkan agar tidak terjadi hitung ganda.",
    `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
  ]);

  return {
    sheet: {
      name: "PENGELUARAN",
      columns: EXPENSE_WIDTHS.map((columnWidth) => ({ width: columnWidth })),
      rows,
      merges,
      freeze: { row: 2, column: 0 },
      pageSetup: { ...LANDSCAPE_PAGE, printTitlesRow: "1:2" },
      properties: { defaultRowHeight: 20 },
    } satisfies WorkbookSheet,
  };
}

function buildPureExpenseSheet(data: FinanceWorkbookData) {
  const operational = data.expenses.filter((item) => item.category !== "PROJECT");
  const grid = createGrid(7);
  const merges: string[] = [];

  setGridRow(grid, 1, [
    { column: 0, cell: cell(`Pengeluaran murni ${data.period.monthTitle}`, { ...TITLE_STYLE, align: "left" }) },
    { column: 1, cell: blank(TITLE_STYLE) },
    { column: 2, cell: blank(TITLE_STYLE) },
    { column: 3, cell: blank(TITLE_STYLE) },
  ]);
  merges.push("A1:D1");
  setGridRow(grid, 2, [
    { column: 0, cell: cell(`Per tgl ${data.period.endDateLabel}`, { ...SUBTITLE_STYLE, align: "left" }) },
    { column: 1, cell: blank(SUBTITLE_STYLE) },
    { column: 2, cell: blank(SUBTITLE_STYLE) },
    { column: 3, cell: blank(SUBTITLE_STYLE) },
  ]);
  merges.push("A2:D2");
  setGridRow(grid, 3, [
    { column: 0, cell: headerCell("TANGGAL", { fill: COLORS.yellow }) },
    { column: 1, cell: headerCell("PENGELUARAN", { fill: COLORS.yellow }) },
    { column: 2, cell: headerCell("TOTAL", { fill: COLORS.yellow }) },
    { column: 3, cell: headerCell("KATEGORI", { fill: COLORS.yellow }) },
    { column: 5, cell: headerCell("RINCIAN PENGELUARAN", { fill: COLORS.yellow }) },
    { column: 6, cell: headerCell(null, { fill: COLORS.yellow }) },
  ]);
  merges.push("F3:G3");
  setGridRow(grid, 4, [
    { column: 5, cell: headerCell("KATEGORI", { fill: COLORS.yellow }) },
    { column: 6, cell: headerCell("TOTAL", { fill: COLORS.yellow }) },
  ]);

  const groups = groupByDate(operational);
  let leftRow = 4;
  for (const [date, items] of groups) {
    const groupStart = leftRow;
    items.forEach((item, index) => {
      setGridRow(grid, leftRow, [
        { column: 0, cell: centerCell(index === 0 ? dayDateLabel(date) : null) },
        { column: 1, cell: dataCell(item.purpose) },
        { column: 2, cell: moneyCell(item.amount) },
        { column: 3, cell: dataCell(item.categoryLabel) },
      ]);
      leftRow += 1;
    });
    if (leftRow - 1 > groupStart) merges.push(`A${groupStart}:A${leftRow - 1}`);
  }
  const leftLastDataRow = leftRow - 1;
  const operationalTotal = sumAmounts(operational, (item) => item.amount);
  setGridRow(grid, leftRow, [
    { column: 0, cell: blank(TOTAL_STYLE) },
    { column: 1, cell: cell("TOTAL", { ...TOTAL_STYLE, align: "left" }) },
    { column: 2, cell: moneyCell(sumFormula("C", 4, leftLastDataRow, operationalTotal), TOTAL_STYLE) },
    { column: 3, cell: blank(TOTAL_STYLE) },
  ]);

  const categories = data.categories.filter((category) => category.key !== "PROJECT");
  let recapRow = 5;
  for (const category of categories) {
    const categoryTotal = sumAmounts(operational.filter((item) => item.category === category.key), (item) => item.amount);
    setGridRow(grid, recapRow, [
      { column: 5, cell: dataCell(category.label) },
      {
        column: 6,
        cell: moneyCell(leftLastDataRow >= 4
          ? { formula: `SUMIF($D$4:$D$${leftLastDataRow},$F${recapRow},$C$4:$C$${leftLastDataRow})`, result: categoryTotal }
          : 0),
      },
    ]);
    recapRow += 1;
  }
  setGridRow(grid, recapRow, [
    { column: 5, cell: cell("TOTAL", { ...TOTAL_STYLE, align: "left" }) },
    { column: 6, cell: moneyCell(sumFormula("C", 4, leftLastDataRow, operationalTotal), TOTAL_STYLE) },
  ]);

  const rows = gridToRows(grid);
  if (rows[0]) rows[0].height = 36;
  if (rows[1]) rows[1].height = 22;
  if (rows[2]) rows[2].height = 28;
  if (rows[3]) rows[3].height = 24;
  addNotes(rows, merges, 7, [
    "Hanya pengeluaran operasional yang masuk ke sheet ini. Pengeluaran project sudah tercatat pada HPP project.",
    `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
  ]);

  return {
    sheet: {
      name: "PNGELUARAN MURNI",
      columns: PURE_WIDTHS.map((columnWidth) => ({ width: columnWidth })),
      rows,
      merges,
      freeze: { row: 3, column: 0 },
      pageSetup: { ...LANDSCAPE_PAGE, printTitlesRow: "1:3" },
      properties: { defaultRowHeight: 20 },
    } satisfies WorkbookSheet,
  };
}

type CashEntry = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  source: string;
  reference: string;
  createdAt: string;
  order: number;
};

function paymentSource(kind: "DEPOSIT" | "DP" | "PELUNASAN" | "PEMBAYARAN") {
  if (kind === "DEPOSIT") return "Deposit";
  if (kind === "DP") return "DP";
  if (kind === "PELUNASAN") return "Pelunasan";
  return "Pembayaran";
}

function buildCashSheet(data: FinanceWorkbookData) {
  const width = 7;
  const rows: WorkbookRow[] = [];
  const merges: string[] = [];
  rows.push({ cells: fullRow(width, "SALDO AKHIR", TITLE_STYLE), height: 36 });
  merges.push("A1:G1");
  rows.push({ cells: fullRow(width, `Tanggal ${data.period.rangeLabel}`, SUBTITLE_STYLE), height: 22 });
  merges.push("A2:G2");

  const thirdHeader = blankRow(width, HEADER_STYLE);
  const fourthHeader = blankRow(width, HEADER_STYLE);
  thirdHeader[0] = headerCell("HARI, TANGGAL");
  thirdHeader[1] = headerCell("KETERANGAN");
  thirdHeader[2] = headerCell("SALDO", { fill: COLORS.orange });
  thirdHeader[3] = headerCell(null, { fill: COLORS.orange });
  thirdHeader[4] = headerCell("SALDO AKHIR");
  thirdHeader[5] = headerCell("SUMBER");
  thirdHeader[6] = headerCell("REFERENSI");
  fourthHeader[2] = headerCell("DEBIT", { fill: COLORS.orange });
  fourthHeader[3] = headerCell("KREDIT", { fill: COLORS.orange });
  rows.push({ cells: thirdHeader, height: 24 });
  rows.push({ cells: fourthHeader, height: 24 });
  merges.push("A3:A4", "B3:B4", "C3:D3", "E3:E4", "F3:F4", "G3:G4");

  const openingRow = rows.length + 1;
  const opening = blankRow(width);
  opening[0] = cell("SALDO AWAL (bisa diubah)", { ...BASE, bold: true, fill: COLORS.input, align: "left" });
  opening[1] = blank({ ...BASE, fill: COLORS.input });
  opening[2] = blank(BASE);
  opening[3] = blank(BASE);
  opening[4] = moneyCell(0, { ...BASE, bold: true, fill: COLORS.input });
  opening[5] = dataCell("Manual");
  opening[6] = dataCell("-");
  rows.push({ cells: opening, height: 22 });
  merges.push(`A${openingRow}:B${openingRow}`);

  const entries: CashEntry[] = [
    ...data.payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paidAt,
      description: `${payment.customer} · ${payment.productName}`,
      debit: payment.amount,
      credit: 0,
      source: paymentSource(payment.kind),
      reference: payment.invoiceNo,
      createdAt: payment.createdAt,
      order: 0,
    })),
    ...data.expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.spentAt,
      description: expense.purpose,
      debit: 0,
      credit: expense.amount,
      source: "Pengeluaran",
      reference: expense.reference,
      createdAt: expense.createdAt,
      order: 1,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.order - right.order || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));

  let balance = 0;
  let groupStart = 0;
  let groupDate = "";
  let lastDataRow = openingRow;
  for (const entry of entries) {
    if (entry.date !== groupDate) {
      if (groupStart > 0 && lastDataRow > groupStart) merges.push(`A${groupStart}:A${lastDataRow}`);
      groupDate = entry.date;
      groupStart = rows.length + 1;
    }
    const rowNumber = rows.length + 1;
    balance += entry.debit - entry.credit;
    rows.push({
      cells: [
        centerCell(rowNumber === groupStart ? dayDateLabel(entry.date) : null),
        dataCell(entry.description),
        moneyCell(blankZero(entry.debit)),
        moneyCell(blankZero(entry.credit)),
        moneyCell({ formula: `E${rowNumber - 1}+C${rowNumber}-D${rowNumber}`, result: balance }),
        dataCell(entry.source),
        dataCell(entry.reference),
      ],
      height: 20,
    });
    lastDataRow = rowNumber;
  }
  if (groupStart > 0 && lastDataRow > groupStart) merges.push(`A${groupStart}:A${lastDataRow}`);

  const finalRow = rows.length + 1;
  const totalDebit = sumAmounts(entries, (entry) => entry.debit);
  const totalCredit = sumAmounts(entries, (entry) => entry.credit);
  const final = blankRow(width, TOTAL_STYLE);
  final[1] = cell("SALDO AKHIR", { ...TOTAL_STYLE, align: "left" });
  final[2] = moneyCell(sumFormula("C", openingRow + 1, lastDataRow, totalDebit), TOTAL_STYLE);
  final[3] = moneyCell(sumFormula("D", openingRow + 1, lastDataRow, totalCredit), TOTAL_STYLE);
  final[4] = moneyCell(
    entries.length
      ? { formula: `E${openingRow}+C${finalRow}-D${finalRow}`, result: balance }
      : { formula: `E${openingRow}`, result: 0 },
    { ...TOTAL_STYLE, fill: COLORS.green, numFmt: CURRENCY },
  );
  rows.push({ cells: final, height: 26 });

  addNotes(rows, merges, width, [
    "Saldo awal default 0. Ubah sel kuning SALDO AWAL bila ingin menyesuaikan saldo awal periode.",
    "Basis kas: pembayaran masuk sebagai debit, pengeluaran sebagai kredit. Baris awal tidak dihitung sebagai transaksi.",
    `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
  ]);

  return {
    sheet: {
      name: "SALDO AKHIR",
      columns: CASH_WIDTHS.map((columnWidth) => ({ width: columnWidth })),
      rows,
      merges,
      freeze: { row: 5, column: 1 },
      pageSetup: { ...LANDSCAPE_PAGE, printTitlesRow: "1:4" },
      properties: { defaultRowHeight: 20 },
    } satisfies WorkbookSheet,
    finalRow,
  };
}

function buildNotesSheet(data: FinanceWorkbookData, refs: { projectTotalRow: number; cashFinalRow: number }) {
  const grid = createGrid(5);
  const merges: string[] = [];

  setGridRow(grid, 1, [
    { column: 0, cell: cell("Catatan", { ...TITLE_STYLE, align: "left" }) },
    { column: 1, cell: blank(TITLE_STYLE) },
  ]);
  merges.push("A1:B1");
  setGridRow(grid, 2, [
    { column: 0, cell: cell(`Per ${data.period.endDateLabel}`, { ...SUBTITLE_STYLE, align: "left" }) },
    { column: 1, cell: blank(SUBTITLE_STYLE) },
  ]);
  merges.push("A2:B2");

  const totalPayments = sumAmounts(data.payments, (payment) => payment.amount);
  const projectExpenses = sumAmounts(data.expenses.filter((expense) => expense.kind === "PROJECT"), (expense) => expense.amount);
  const operationalExpenses = sumAmounts(data.expenses.filter((expense) => expense.kind === "OPERASIONAL"), (expense) => expense.amount);
  const finalBalance = totalPayments - projectExpenses - operationalExpenses;
  const totalInvoice = sumAmounts(data.projects, (project) => project.totalInvoice);
  const totalHpp = sumAmounts(data.projects, (project) => project.totalHpp);
  const totalNetProfit = sumAmounts(data.projects.filter((project) => project.hppComplete), (project) => project.netProfit ?? 0);
  const completeInvoice = sumAmounts(data.projects.filter((project) => project.hppComplete), (project) => project.totalInvoice);

  const summary: Array<[number, string, string, number]> = [
    [3, "Uang masuk", `'SALDO AKHIR'!C${refs.cashFinalRow}`, totalPayments],
    [4, "Terbelanjakan project", `SUMIF('PENGELUARAN'!E:E,"Project",'PENGELUARAN'!F:F)`, projectExpenses],
    [5, "Sisa setelah project", "B3-B4", totalPayments - projectExpenses],
    [6, "Pengeluaran operasional", `SUMIF('PENGELUARAN'!E:E,"Operasional",'PENGELUARAN'!F:F)`, operationalExpenses],
    [7, "Bersih", "B5-B6", finalBalance],
    [8, "Saldo akhir", `'SALDO AKHIR'!E${refs.cashFinalRow}`, finalBalance],
  ];
  for (const [rowNumber, label, formula, result] of summary) {
    setGridRow(grid, rowNumber, [
      { column: 0, cell: dataCell(label, { bold: rowNumber === 8, fill: rowNumber === 8 ? COLORS.input : undefined }) },
      { column: 1, cell: moneyCell({ formula, result }, { bold: rowNumber === 8, fill: rowNumber === 8 ? COLORS.input : undefined }) },
    ]);
  }

  setGridRow(grid, 10, [
    { column: 0, cell: cell("RINGKASAN PROJECT (SEMUA PROJECT AKTIF)", SECTION_STYLE) },
    { column: 1, cell: blank(SECTION_STYLE) },
  ]);
  merges.push("A10:B10");
  const projectSummary: Array<[number, string, string, number | string]> = [
    [11, "Total invoice", `'PROJECT'!M${refs.projectTotalRow}`, totalInvoice],
    [12, "Total HPP tercatat", `'PROJECT'!L${refs.projectTotalRow}`, totalHpp],
    [13, "Laba project (HPP lengkap)", `'PROJECT'!N${refs.projectTotalRow}`, totalNetProfit],
    [14, "Margin (HPP lengkap)", `IF(SUMIF('PROJECT'!U:U,"Lengkap",'PROJECT'!M:M)=0,"",B13/SUMIF('PROJECT'!U:U,"Lengkap",'PROJECT'!M:M))`, completeInvoice === 0 ? "" : totalNetProfit / completeInvoice],
  ];
  for (const [rowNumber, label, formula, result] of projectSummary) {
    setGridRow(grid, rowNumber, [
      { column: 0, cell: dataCell(label) },
      { column: 1, cell: rowNumber === 14 ? percentCell({ formula, result }) : moneyCell({ formula, result }) },
    ]);
  }

  setGridRow(grid, 2, [
    { column: 3, cell: cell(`Deposit ${data.period.monthTitle}`, SECTION_STYLE) },
    { column: 4, cell: blank(SECTION_STYLE) },
  ]);
  merges.push("D2:E2");
  setGridRow(grid, 3, [
    { column: 3, cell: headerCell("KETERANGAN", { fill: COLORS.yellow }) },
    { column: 4, cell: headerCell("TOTAL", { fill: COLORS.yellow }) },
  ]);
  const deposits = data.payments.filter((payment) => payment.kind === "DEPOSIT");
  let depositRow = 4;
  for (const deposit of deposits) {
    setGridRow(grid, depositRow, [
      { column: 3, cell: dataCell(`Deposit ${deposit.customer} · ${deposit.invoiceNo}`) },
      { column: 4, cell: moneyCell(deposit.amount) },
    ]);
    depositRow += 1;
  }
  if (!deposits.length) {
    setGridRow(grid, depositRow, [
      { column: 3, cell: dataCell("Tidak ada deposit pada periode ini") },
      { column: 4, cell: moneyCell(null) },
    ]);
    depositRow += 1;
  }
  setGridRow(grid, depositRow, [
    { column: 3, cell: cell("TOTAL DEPOSIT", { ...TOTAL_STYLE, align: "left" }) },
    { column: 4, cell: moneyCell(sumFormula("E", 4, depositRow - 1, sumAmounts(deposits, (deposit) => deposit.amount)), TOTAL_STYLE) },
  ]);

  const noteStart = Math.max(16, depositRow + 2);
  const notes = [
    "Basis data: kas untuk pembayaran dan pengeluaran; HPP dihitung dari komponen yang tercatat pada project.",
    "Deposit/DP/Pelunasan di sheet DP adalah total sampai tanggal export; Pembayaran Periode adalah transaksi dalam periode.",
    "Saldo awal sheet SALDO AKHIR default 0 dan bisa diubah manual di sel kuning.",
    `Dibuat otomatis oleh Askonveksi pada ${data.generatedAt}.`,
  ];
  const noteStyle: CellStyle = { italic: true, size: 9, color: COLORS.muted, wrap: true, vertical: "middle" };
  notes.forEach((note, index) => {
    const rowNumber = noteStart + index;
    setGridRow(grid, rowNumber, [
      { column: 0, cell: cell(note, noteStyle) },
      ...[1, 2, 3, 4].map((column) => ({ column, cell: blank(noteStyle) })),
    ]);
    merges.push(`A${rowNumber}:E${rowNumber}`);
  });

  const rows = gridToRows(grid);
  if (rows[0]) rows[0].height = 36;
  if (rows[1]) rows[1].height = 22;
  if (rows[9]) rows[9].height = 24;
  for (let index = 0; index < notes.length; index += 1) {
    const row = rows[noteStart + index - 1];
    if (row) row.height = 28;
  }
  return {
    sheet: {
      name: "CATATAN",
      columns: NOTES_WIDTHS.map((columnWidth) => ({ width: columnWidth })),
      rows,
      merges,
      pageSetup: { ...PORTRAIT_PAGE, printTitlesRow: "1:2" },
      properties: { defaultRowHeight: 20 },
    } satisfies WorkbookSheet,
  };
}

export function buildFinanceWorkbookSpec(data: FinanceWorkbookData): WorkbookPayload {
  const project = buildProjectLikeSheet(data, "project");
  const dp = buildProjectLikeSheet(data, "dp");
  const expense = buildExpenseSheet(data);
  const cash = buildCashSheet(data);
  const pure = buildPureExpenseSheet(data);
  const notes = buildNotesSheet(data, { projectTotalRow: project.totalRow, cashFinalRow: cash.finalRow });

  const sheets = data.scope === "laporan"
    ? [project.sheet, expense.sheet, cash.sheet, dp.sheet, pure.sheet, notes.sheet]
    : data.scope === "pemasukan"
      ? [project.sheet, dp.sheet]
      : [expense.sheet, cash.sheet, pure.sheet];

  const operationalCount = data.expenses.filter((expenseItem) => expenseItem.kind === "OPERASIONAL").length;
  const depositCount = data.payments.filter((payment) => payment.kind === "DEPOSIT").length;
  const rowCount = data.scope === "laporan"
    ? data.projects.length * 2 + data.expenses.length * 2 + data.payments.length + operationalCount + depositCount
    : data.scope === "pemasukan"
      ? data.projects.length * 2
      : data.expenses.length + data.payments.length + operationalCount;

  return {
    spec: { sheets },
    subject: `laporan-keuangan-${data.period.from}-${data.period.to}`,
    rowCount,
    periodLabel: data.period.label,
  };
}
