import "server-only";

import type { ExecutiveAnalyticsData, ExecutiveInsight } from "@/lib/crm/analytics-data";
import type { FullDashboardData } from "@/lib/crm/dashboard-data";
import type { LeadSourceAnalyticsData, LeadSourceInsight } from "@/lib/crm/lead-sources-data";
import { formatDate } from "@/lib/crm/format";
import type { WorkbookCell, WorkbookCellValue, WorkbookPayload, WorkbookRow, WorkbookSheet } from "@/lib/export/workbook-types";

const COLORS = {
  title: "FF1F4E78",
  header: "FF1F4E78",
  accent: "FF0031EA",
  muted: "FF6B7280",
  white: "FFFFFFFF",
  stripe: "FFF8FAFC",
} as const;

const NUMBER_FORMAT = "#,##0";
const DECIMAL_FORMAT = "#,##0.0";
const CURRENCY_FORMAT = '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-;_-@_-';
const PERCENT_FORMAT = '0.00"%"';

type ColumnFormat = "text" | "number" | "decimal" | "currency" | "percent" | "date" | "datetime";

type TableColumn = {
  header: string;
  width: number;
  format?: ColumnFormat;
};

type FilterMeta = {
  leadSources: Array<{ id: string; name: string }>;
  productCategories: Array<{ id: string; name: string }>;
};

function columnLetter(index: number) {
  let value = index;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function alignFor(format: ColumnFormat): "left" | "center" | "right" {
  if (format === "text") return "left";
  if (format === "date" || format === "datetime") return "center";
  return "right";
}

function row(cells: WorkbookCell[]): WorkbookRow {
  return { cells };
}

function textCell(value: string | number | null | undefined): WorkbookCell {
  if (value === null || value === undefined || value === "") return { value: null, align: "left" };
  return { value, align: "left" };
}

function numericCell(value: number | null | undefined, numFmt = NUMBER_FORMAT): WorkbookCell {
  if (value === null || value === undefined || !Number.isFinite(value)) return { value: null, numFmt, align: "right" };
  return { value, numFmt, align: "right" };
}

function parseMoney(value: string | null | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function displayDate(value: string | null | undefined) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : value;
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value, true) : value;
}

function insightTypeLabel(type: ExecutiveInsight["type"] | LeadSourceInsight["type"]) {
  if (type === "positive") return "Positif";
  if (type === "warning") return "Perhatian";
  if (type === "opportunity") return "Peluang";
  return "Tindakan";
}

function filterText(filters: { sourceId: string; categoryId: string }, meta: FilterMeta) {
  const parts: string[] = [];
  if (filters.sourceId) {
    const name = meta.leadSources.find((item) => item.id === filters.sourceId)?.name ?? filters.sourceId;
    parts.push(`Sumber lead: ${name}`);
  }
  if (filters.categoryId) {
    const name = meta.productCategories.find((item) => item.id === filters.categoryId)?.name ?? filters.categoryId;
    parts.push(`Kategori produk: ${name}`);
  }
  return parts.length ? `Filter: ${parts.join(" · ")}` : "";
}

function subtitle(periodLabel: string, actorName: string, filter = "") {
  return [
    `Periode: ${periodLabel}`,
    filter,
    `Dibuat: ${formatDate(new Date(), true)} WIB`,
    `Oleh: ${actorName}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function summaryRow(
  label: string,
  current: string | number | null | undefined,
  previous: string | number | null | undefined = null,
  growth: number | null | undefined = null,
  format: ColumnFormat = "text",
): WorkbookRow {
  const valueCell = (value: string | number | null | undefined): WorkbookCell => {
    if (value === null || value === undefined || value === "") return { value: null, align: "right" };
    if (typeof value !== "number") return { value, align: "left" };
    if (format === "currency") return numericCell(value, CURRENCY_FORMAT);
    if (format === "percent") return numericCell(value, PERCENT_FORMAT);
    if (format === "decimal") return numericCell(value, DECIMAL_FORMAT);
    if (format === "number") return numericCell(value, NUMBER_FORMAT);
    return { value, align: "right" };
  };
  return row([
    { value: label, bold: true, align: "left" },
    valueCell(current),
    valueCell(previous),
    typeof growth === "number" && Number.isFinite(growth)
      ? numericCell(growth, PERCENT_FORMAT)
      : { value: null, align: "right" },
  ]);
}

function metricRow(label: string, value: WorkbookCellValue, numFmt?: string): WorkbookRow {
  return row([
    { value: label, bold: true, align: "left" },
    { value, ...(numFmt ? { numFmt } : {}), align: typeof value === "number" ? "right" : "left" },
  ]);
}

function tableSheet({
  name,
  title,
  description,
  columns,
  dataRows,
  notes,
}: {
  name: string;
  title: string;
  description: string;
  columns: TableColumn[];
  dataRows: WorkbookRow[];
  notes?: string[];
}): WorkbookSheet {
  const width = columns.length;
  const lastColumn = columnLetter(width);
  const rows: WorkbookRow[] = [];
  const merges: string[] = [];

  rows.push({
    height: 26,
    cells: [
      {
        value: title,
        fill: COLORS.title,
        color: COLORS.white,
        bold: true,
        size: 14,
        align: "left",
        vertical: "middle",
        wrap: true,
      },
    ],
  });
  merges.push(`A1:${lastColumn}1`);

  rows.push({
    height: 32,
    cells: [{ value: description, italic: true, size: 9, color: COLORS.muted, vertical: "middle", wrap: true }],
  });
  merges.push(`A2:${lastColumn}2`);

  rows.push({ height: 6, cells: [] });

  rows.push({
    height: 30,
    cells: columns.map((column) => ({
      value: column.header,
      fill: COLORS.header,
      color: COLORS.white,
      bold: true,
      align: "center",
      vertical: "middle",
      wrap: true,
      border: "thin",
    })),
  });

  dataRows.forEach((dataRow, index) => {
    rows.push({
      height: dataRow.height,
      cells: dataRow.cells.map((item, cellIndex) => {
        const format = columns[cellIndex]?.format ?? "text";
        return {
          border: "thin",
          vertical: "top",
          wrap: true,
          ...(index % 2 === 1 ? { fill: COLORS.stripe } : {}),
          ...item,
          align: item.align ?? alignFor(format),
        };
      }),
    });
  });

  if (notes?.length) {
    rows.push({ height: 8, cells: [] });
    const noteWidth = columns.reduce((total, column) => total + column.width, 0);
    for (const note of notes) {
      const rowNumber = rows.length + 1;
      rows.push({
        height: Math.max(16, Math.ceil(note.length / Math.max(20, noteWidth - 4)) * 15),
        cells: [{ value: note, italic: true, size: 9, color: COLORS.muted, vertical: "middle", wrap: true }],
      });
      merges.push(`A${rowNumber}:${lastColumn}${rowNumber}`);
    }
  }

  const lastDataRow = 4 + dataRows.length;
  return {
    name,
    columns: columns.map((column) => ({ width: column.width })),
    rows,
    merges,
    freeze: { row: 4, column: 0 },
    autoFilter: dataRows.length
      ? { fromRow: 4, toRow: lastDataRow, fromColumn: 1, toColumn: width }
      : undefined,
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: "4:4",
    },
    properties: { defaultRowHeight: 18 },
  };
}

function makePayload(sheets: WorkbookSheet[], subject: string, periodLabel: string): WorkbookPayload {
  const rowCount = sheets.reduce((total, sheet) => {
    const filter = sheet.autoFilter;
    if (!filter) return total;
    return total + Math.max(0, filter.toRow - filter.fromRow);
  }, 0);
  return {
    spec: { sheets },
    subject,
    rowCount,
    periodLabel,
  };
}

/* --------------------------------- Dashboard -------------------------------- */

export function buildDashboardWorkbookSpec(data: FullDashboardData): WorkbookPayload {
  const filter = filterText(data.filters, data.filterMeta);
  const description = subtitle(data.period.label, data.actor.name, filter);

  const summary = tableSheet({
    name: "Ringkasan",
    title: "Laporan Dashboard Sales & Marketing",
    description,
    columns: [
      { header: "Metrik", width: 34, format: "text" },
      { header: "Nilai", width: 24, format: "number" },
      { header: "Periode Sebelumnya", width: 24, format: "number" },
      { header: "Perubahan", width: 16, format: "percent" },
    ],
    dataRows: [
      summaryRow("Total Lead", data.summary.totalLead, data.summary.prevLead, data.summary.leadGrowth, "number"),
      summaryRow("Total Deal", data.summary.totalDeal, data.summary.prevDeal, data.summary.dealGrowth, "number"),
      summaryRow("Total Order", data.summary.totalOrder, data.summary.prevOrder, data.summary.orderGrowth, "number"),
      summaryRow("Total Omzet", data.summary.totalOmzetNum, parseMoney(data.summary.prevOmzet), data.summary.omzetGrowth, "currency"),
      summaryRow("Total Volume (pcs)", data.summary.totalVolumePcs, data.summary.prevVolumePcs, data.summary.volumeGrowth, "number"),
      summaryRow("Win Rate Closing", data.summary.winRate, data.summary.prevWinRate, data.summary.winRateGrowth, "percent"),
      summaryRow("Uang Masuk Bulan Ini", data.cashflow.moneyInNum, null, null, "currency"),
      summaryRow("Piutang Tertahan", data.cashflow.outstandingNum, null, null, "currency"),
      summaryRow("Order Belum Lunas", data.cashflow.outstandingOrderCount, null, null, "number"),
    ],
    notes: ["Nilai finansial pada laporan ini mengikuti hak akses pengguna yang mengekspor."],
  });

  const insights = tableSheet({
    name: "Insight & Rekomendasi",
    title: "Insight & Rekomendasi Dashboard",
    description,
    columns: [
      { header: "Pilar", width: 24, format: "text" },
      { header: "Judul", width: 44, format: "text" },
      { header: "Penjelasan", width: 72, format: "text" },
    ],
    dataRows: [
      row([
        textCell("Status Omzet"),
        textCell(data.insights.omzetStatus.title),
        textCell(data.insights.omzetStatus.description),
      ]),
      row([
        textCell("Sumber Lead Terbaik"),
        textCell(data.insights.topLeadSource.title),
        textCell(data.insights.topLeadSource.description),
      ]),
      row([
        textCell("Kategori Terlaris"),
        textCell(data.insights.bestSellingCategory.title),
        textCell(data.insights.bestSellingCategory.description),
      ]),
      row([
        textCell("Rekomendasi"),
        textCell(data.insights.recommendation.title),
        textCell(data.insights.recommendation.description),
      ]),
    ],
  });

  const trend = tableSheet({
    name: "Tren Harian",
    title: "Tren Harian",
    description,
    columns: [
      { header: "Tanggal", width: 18, format: "text" },
      { header: "Omzet", width: 18, format: "currency" },
      { header: "Order", width: 12, format: "number" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Volume (pcs)", width: 14, format: "number" },
    ],
    dataRows: data.trendData.map((point) =>
      row([
        textCell(point.fullDate || point.date),
        numericCell(point.omzet, CURRENCY_FORMAT),
        numericCell(point.orders),
        numericCell(point.leads),
        numericCell(point.pcs),
      ]),
    ),
  });

  const leadSources = tableSheet({
    name: "Sumber Lead",
    title: "Performa Sumber Lead",
    description,
    columns: [
      { header: "No", width: 8, format: "number" },
      { header: "Sumber Lead", width: 28, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Order", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Konversi", width: 14, format: "percent" },
    ],
    dataRows: data.leadSourceTable.map((item) =>
      row([
        numericCell(item.no),
        textCell(item.name),
        numericCell(item.leadCount),
        numericCell(item.dealCount),
        numericCell(item.orderCount),
        numericCell(item.revenueNum, CURRENCY_FORMAT),
        numericCell(item.conversionRate, PERCENT_FORMAT),
      ]),
    ),
  });

  const categories = tableSheet({
    name: "Kategori Produk",
    title: "Performa Kategori Produk",
    description,
    columns: [
      { header: "Kategori", width: 30, format: "text" },
      { header: "Order", width: 12, format: "number" },
      { header: "Volume (pcs)", width: 14, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Pangsa Omzet", width: 16, format: "percent" },
    ],
    dataRows: data.categoryProgress.map((item) => {
      const revenue = data.categoryRevenueDonut.find((entry) => entry.name === item.name);
      return row([
        textCell(item.name),
        numericCell(item.count),
        numericCell(item.pcs),
        numericCell(revenue?.revenueNum ?? null, CURRENCY_FORMAT),
        numericCell(item.percentage, PERCENT_FORMAT),
      ]);
    }),
  });

  const funnel = tableSheet({
    name: "Funnel Konversi",
    title: "Funnel Konversi",
    description,
    columns: [
      { header: "Tahap", width: 18, format: "text" },
      { header: "Label", width: 28, format: "text" },
      { header: "Jumlah", width: 14, format: "number" },
      { header: "Konversi", width: 14, format: "percent" },
      { header: "Drop-off", width: 14, format: "percent" },
    ],
    dataRows: data.conversionFunnel.map((item) =>
      row([
        textCell(item.stage),
        textCell(item.label),
        numericCell(item.count),
        numericCell(item.percentage, PERCENT_FORMAT),
        numericCell(item.dropOffRate, PERCENT_FORMAT),
      ]),
    ),
  });

  const segmentation = tableSheet({
    name: "Segmentasi Customer",
    title: "Segmentasi Customer",
    description,
    columns: [
      { header: "Tipe Customer", width: 26, format: "text" },
      { header: "Order", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Pangsa Omzet", width: 16, format: "percent" },
    ],
    dataRows: data.customerSegmentation.map((item) =>
      row([
        textCell(item.type),
        numericCell(item.orderCount),
        numericCell(item.revenueNum, CURRENCY_FORMAT),
        numericCell(item.percentage, PERCENT_FORMAT),
      ]),
    ),
  });

  const retention = tableSheet({
    name: "Retensi",
    title: "Retensi Customer",
    description,
    columns: [
      { header: "Metrik", width: 36, format: "text" },
      { header: "Nilai", width: 20, format: "number" },
    ],
    dataRows: [
      metricRow("Customer Baru", data.retention.newCustomerCount, NUMBER_FORMAT),
      metricRow("Customer Repeat", data.retention.repeatCustomerCount, NUMBER_FORMAT),
      metricRow("Repeat Rate", data.retention.repeatRate, PERCENT_FORMAT),
      metricRow("Total Customer Aktif", data.retention.totalActiveCustomers, NUMBER_FORMAT),
    ],
  });

  const topCustomers = tableSheet({
    name: "Top Customer",
    title: "Top Customer",
    description,
    columns: [
      { header: "Nama Customer", width: 28, format: "text" },
      { header: "Perusahaan / Komunitas", width: 30, format: "text" },
      { header: "Tipe", width: 20, format: "text" },
      { header: "Order", width: 10, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Order Terakhir", width: 18, format: "date" },
      { header: "WhatsApp", width: 18, format: "text" },
    ],
    dataRows: data.topCustomers.map((customer) =>
      row([
        textCell(customer.name),
        textCell(customer.companyName),
        textCell(customer.customerType),
        numericCell(customer.orderCount),
        numericCell(customer.revenueNum, CURRENCY_FORMAT),
        textCell(displayDate(customer.lastOrderDate)),
        textCell(customer.whatsapp),
      ]),
    ),
  });

  const channels = tableSheet({
    name: "Efisiensi Kanal",
    title: "Efisiensi Kanal Akuisisi",
    description,
    columns: [
      { header: "Kanal", width: 26, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Order", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Win Rate", width: 14, format: "percent" },
      { header: "Status", width: 22, format: "text" },
    ],
    dataRows: data.channelEfficiency.map((item) =>
      row([
        textCell(item.channel),
        numericCell(item.leadCount),
        numericCell(item.dealCount),
        numericCell(item.orderCount),
        numericCell(parseMoney(item.revenue), CURRENCY_FORMAT),
        numericCell(item.winRate, PERCENT_FORMAT),
        textCell(item.status),
      ]),
    ),
  });

  const pics = tableSheet({
    name: "Kinerja PIC",
    title: "Kinerja PIC Sales",
    description,
    columns: [
      { header: "PIC", width: 28, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Win Rate", width: 14, format: "percent" },
    ],
    dataRows: data.picPerformance.map((item) =>
      row([
        textCell(item.picName),
        numericCell(item.leadCount),
        numericCell(item.dealCount),
        numericCell(item.revenueNum, CURRENCY_FORMAT),
        numericCell(item.winRate, PERCENT_FORMAT),
      ]),
    ),
  });

  const operations = tableSheet({
    name: "Operasional",
    title: "Operasional Produksi",
    description,
    columns: [
      { header: "Metrik", width: 34, format: "text" },
      { header: "Nilai", width: 18, format: "number" },
    ],
    dataRows: [
      metricRow("Work Order Aktif", data.operational.activeWorkOrders, NUMBER_FORMAT),
      metricRow("Mendekati Deadline", data.operational.approachingDeadlineCount, NUMBER_FORMAT),
      metricRow("Terlambat", data.operational.overdueCount, NUMBER_FORMAT),
    ],
  });

  const stages = tableSheet({
    name: "Tahap Produksi",
    title: "Sebaran Tahap Produksi",
    description,
    columns: [
      { header: "Tahap", width: 18, format: "text" },
      { header: "Label", width: 28, format: "text" },
      { header: "Jumlah WO", width: 14, format: "number" },
    ],
    dataRows: data.operational.stages.map((stage) =>
      row([textCell(stage.stage), textCell(stage.label), numericCell(stage.count)]),
    ),
  });

  const recentOrders = tableSheet({
    name: "Pesanan Terbaru",
    title: "Pesanan Terbaru",
    description,
    columns: [
      { header: "No. Order", width: 20, format: "text" },
      { header: "Customer", width: 26, format: "text" },
      { header: "Produk", width: 28, format: "text" },
      { header: "Qty", width: 10, format: "number" },
      { header: "Status", width: 16, format: "text" },
      { header: "Total", width: 20, format: "currency" },
      { header: "Tanggal", width: 18, format: "date" },
    ],
    dataRows: data.recentOrders.map((order) =>
      row([
        textCell(order.orderNo),
        textCell(order.customerName),
        textCell(order.productName),
        numericCell(order.totalQty),
        textCell(order.status),
        numericCell(order.totalNum, CURRENCY_FORMAT),
        textCell(order.formattedDate),
      ]),
    ),
  });

  const urgent = tableSheet({
    name: "Aksi Urgent",
    title: "Aksi Follow-up Urgent",
    description,
    columns: [
      { header: "Judul Peluang", width: 34, format: "text" },
      { header: "Customer", width: 26, format: "text" },
      { header: "Aksi Berikutnya", width: 36, format: "text" },
      { header: "Jadwal", width: 20, format: "datetime" },
      { header: "Status", width: 16, format: "text" },
    ],
    dataRows: data.urgentActions.map((action) =>
      row([
        textCell(action.title),
        textCell(action.customerName),
        textCell(action.nextAction),
        textCell(displayDateTime(action.nextActionAt)),
        textCell(action.isOverdue ? "Terlambat" : "Terjadwal"),
      ]),
    ),
  });

  const sheets = [
    summary,
    insights,
    trend,
    leadSources,
    categories,
    funnel,
    segmentation,
    retention,
    topCustomers,
    channels,
    pics,
    operations,
    stages,
    recentOrders,
    urgent,
  ];
  return makePayload(sheets, `laporan-dashboard-${data.period.label}`, data.period.label);
}

/* --------------------------------- Analytics -------------------------------- */

export function buildExecutiveAnalyticsWorkbookSpec(data: ExecutiveAnalyticsData): WorkbookPayload {
  const filter = filterText(data.filters, data.filterMeta);
  const description = subtitle(data.period.label, data.actor.name, filter);

  const summary = tableSheet({
    name: "Ringkasan Eksekutif",
    title: "Laporan Executive Business Analytics",
    description,
    columns: [
      { header: "Metrik", width: 36, format: "text" },
      { header: "Nilai", width: 24, format: "number" },
      { header: "Periode Sebelumnya", width: 24, format: "number" },
      { header: "Perubahan", width: 16, format: "percent" },
    ],
    dataRows: [
      summaryRow("Total Omzet", data.summary.totalRevenue, data.summary.prevRevenue, data.summary.revenueGrowth, "currency"),
      summaryRow("Total HPP", data.summary.totalHpp, null, null, "currency"),
      summaryRow("Gross Profit", data.summary.totalGrossProfit, data.summary.prevGrossProfit, data.summary.grossProfitGrowth, "currency"),
      summaryRow("Gross Margin", data.summary.grossMarginPercent, null, null, "percent"),
      summaryRow("Status Margin", data.summary.marginStatus),
      summaryRow("Total Sales Order", data.summary.totalOrders, data.summary.prevOrders, data.summary.orderGrowth, "number"),
      summaryRow("Total Volume (pcs)", data.summary.totalPcs, data.summary.prevPcs, data.summary.pcsGrowth, "number"),
      summaryRow("Average Order Value", data.summary.aov, data.summary.prevAov, data.summary.aovGrowth, "currency"),
      summaryRow("Win Rate", data.summary.winRate, data.summary.prevWinRate, data.summary.winRateGrowth, "percent"),
      summaryRow("Uang Masuk", data.summary.cashInflow, null, null, "currency"),
      summaryRow("Piutang Tertahan (AR)", data.summary.outstandingAr, null, null, "currency"),
      summaryRow("Order Belum Lunas", data.summary.unpaidOrdersCount, null, null, "number"),
    ],
  });

  const insights = tableSheet({
    name: "Insight & Rekomendasi",
    title: "Insight & Rekomendasi Eksekutif",
    description,
    columns: [
      { header: "Tipe", width: 16, format: "text" },
      { header: "Judul", width: 42, format: "text" },
      { header: "Penjelasan", width: 76, format: "text" },
      { header: "Rekomendasi Aksi", width: 40, format: "text" },
    ],
    dataRows: data.insights.map((insight) =>
      row([
        textCell(insightTypeLabel(insight.type)),
        textCell(insight.title),
        textCell(insight.description),
        textCell(insight.actionText),
      ]),
    ),
  });

  const trend = tableSheet({
    name: "Tren Harian",
    title: "Tren Omzet, Profit, dan Order",
    description,
    columns: [
      { header: "Tanggal", width: 18, format: "text" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "HPP", width: 20, format: "currency" },
      { header: "Gross Profit", width: 20, format: "currency" },
      { header: "Order", width: 12, format: "number" },
      { header: "Volume (pcs)", width: 14, format: "number" },
      { header: "Lead", width: 12, format: "number" },
    ],
    dataRows: data.trendData.map((point) =>
      row([
        textCell(point.fullDate || point.date),
        numericCell(point.revenue, CURRENCY_FORMAT),
        numericCell(point.hpp, CURRENCY_FORMAT),
        numericCell(point.profit, CURRENCY_FORMAT),
        numericCell(point.orders),
        numericCell(point.pcs),
        numericCell(point.leads),
      ]),
    ),
  });

  const funnel = tableSheet({
    name: "Funnel Konversi",
    title: "Funnel Konversi",
    description,
    columns: [
      { header: "Tahap", width: 18, format: "text" },
      { header: "Label", width: 28, format: "text" },
      { header: "Jumlah", width: 14, format: "number" },
      { header: "Konversi vs Lead", width: 18, format: "percent" },
      { header: "Step Konversi", width: 16, format: "percent" },
      { header: "Drop-off", width: 14, format: "percent" },
    ],
    dataRows: data.funnel.map((stage) =>
      row([
        textCell(stage.stage),
        textCell(stage.label),
        numericCell(stage.count),
        numericCell(stage.conversion, PERCENT_FORMAT),
        numericCell(stage.stepConversion, PERCENT_FORMAT),
        numericCell(stage.dropOffRate, PERCENT_FORMAT),
      ]),
    ),
  });

  const products = tableSheet({
    name: "Produk & Margin",
    title: "Profitabilitas Produk",
    description,
    columns: [
      { header: "Produk", width: 30, format: "text" },
      { header: "Kategori", width: 24, format: "text" },
      { header: "Order", width: 10, format: "number" },
      { header: "Qty (pcs)", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "HPP", width: 20, format: "currency" },
      { header: "Gross Profit", width: 20, format: "currency" },
      { header: "Margin", width: 12, format: "percent" },
      { header: "Status Margin", width: 18, format: "text" },
      { header: "ASP", width: 18, format: "currency" },
      { header: "ACP", width: 18, format: "currency" },
      { header: "Profit / pcs", width: 18, format: "currency" },
      { header: "HPP Lengkap", width: 14, format: "text" },
    ],
    dataRows: data.products.map((product) =>
      row([
        textCell(product.productName),
        textCell(product.categoryName),
        numericCell(product.orderCount),
        numericCell(product.quantity),
        numericCell(product.revenue, CURRENCY_FORMAT),
        numericCell(product.hpp, CURRENCY_FORMAT),
        numericCell(product.grossProfit, CURRENCY_FORMAT),
        numericCell(product.marginPercent, PERCENT_FORMAT),
        textCell(product.marginStatus),
        numericCell(product.asp, CURRENCY_FORMAT),
        numericCell(product.acp, CURRENCY_FORMAT),
        numericCell(product.profitPerPcs, CURRENCY_FORMAT),
        textCell(product.isCostComplete ? "Lengkap" : `Belum lengkap (${product.costedOrderCount} order)`),
      ]),
    ),
  });

  const channels = tableSheet({
    name: "Kanal Akuisisi",
    title: "Efektivitas Kanal Akuisisi",
    description,
    columns: [
      { header: "Kanal", width: 28, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Order", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Win Rate", width: 14, format: "percent" },
      { header: "AOV", width: 20, format: "currency" },
      { header: "Pangsa Omzet", width: 16, format: "percent" },
      { header: "Efisiensi", width: 22, format: "text" },
    ],
    dataRows: data.channels.map((channel) =>
      row([
        textCell(channel.channelName),
        numericCell(channel.leadCount),
        numericCell(channel.dealCount),
        numericCell(channel.orderCount),
        numericCell(channel.revenue, CURRENCY_FORMAT),
        numericCell(channel.winRate, PERCENT_FORMAT),
        numericCell(channel.avgDealValue, CURRENCY_FORMAT),
        numericCell(channel.revenueShare, PERCENT_FORMAT),
        textCell(channel.efficiency),
      ]),
    ),
  });

  const pics = tableSheet({
    name: "Kinerja PIC",
    title: "Kinerja PIC Sales",
    description,
    columns: [
      { header: "PIC", width: 28, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Win Rate", width: 14, format: "percent" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Volume (pcs)", width: 14, format: "number" },
      { header: "AOV", width: 20, format: "currency" },
    ],
    dataRows: data.pics.map((pic) =>
      row([
        textCell(pic.picName),
        numericCell(pic.leadCount),
        numericCell(pic.dealCount),
        numericCell(pic.winRate, PERCENT_FORMAT),
        numericCell(pic.revenue, CURRENCY_FORMAT),
        numericCell(pic.pcsCount),
        numericCell(pic.aov, CURRENCY_FORMAT),
      ]),
    ),
  });

  const retention = tableSheet({
    name: "Retensi",
    title: "Retensi Customer",
    description,
    columns: [
      { header: "Metrik", width: 36, format: "text" },
      { header: "Nilai", width: 20, format: "number" },
    ],
    dataRows: [
      metricRow("Customer Baru", data.retention.newCustomerCount, NUMBER_FORMAT),
      metricRow("Customer Repeat", data.retention.repeatCustomerCount, NUMBER_FORMAT),
      metricRow("Repeat Rate", data.retention.repeatRate, PERCENT_FORMAT),
    ],
  });

  const topCustomers = tableSheet({
    name: "Top Customer",
    title: "Top Customer",
    description,
    columns: [
      { header: "No. Customer", width: 18, format: "text" },
      { header: "Nama Customer", width: 28, format: "text" },
      { header: "Perusahaan", width: 28, format: "text" },
      { header: "Kota", width: 18, format: "text" },
      { header: "WhatsApp", width: 18, format: "text" },
      { header: "Order", width: 10, format: "number" },
      { header: "Total Belanja", width: 20, format: "currency" },
      { header: "AOV", width: 20, format: "currency" },
      { header: "Order Terakhir", width: 18, format: "date" },
    ],
    dataRows: data.retention.topCustomers.map((customer) =>
      row([
        textCell(customer.customerNo),
        textCell(customer.name),
        textCell(customer.companyName),
        textCell(customer.city),
        textCell(customer.whatsapp),
        numericCell(customer.orderCount),
        numericCell(customer.totalSpend, CURRENCY_FORMAT),
        numericCell(customer.aov, CURRENCY_FORMAT),
        textCell(displayDate(customer.lastOrderDate)),
      ]),
    ),
  });

  const operations = tableSheet({
    name: "Operasional",
    title: "Operasional Produksi",
    description,
    columns: [
      { header: "Metrik", width: 36, format: "text" },
      { header: "Nilai", width: 18, format: "number" },
    ],
    dataRows: [
      metricRow("Work Order Aktif", data.operations.activeWorkOrders, NUMBER_FORMAT),
      metricRow("Mendekati Deadline", data.operations.approachingDeadlineCount, NUMBER_FORMAT),
      metricRow("Terlambat", data.operations.overdueCount, NUMBER_FORMAT),
      metricRow("Retur", data.operations.returCount, NUMBER_FORMAT),
    ],
  });

  const stages = tableSheet({
    name: "Tahap Produksi",
    title: "Sebaran Tahap Produksi",
    description,
    columns: [
      { header: "Tahap", width: 18, format: "text" },
      { header: "Label", width: 28, format: "text" },
      { header: "Jumlah WO", width: 14, format: "number" },
      { header: "Pangsa", width: 14, format: "percent" },
    ],
    dataRows: data.operations.stageBreakdown.map((stage) =>
      row([
        textCell(stage.stage),
        textCell(stage.label),
        numericCell(stage.count),
        numericCell(stage.percentage, PERCENT_FORMAT),
      ]),
    ),
  });

  const alerts = tableSheet({
    name: "Alert",
    title: "Peringatan Operasional",
    description,
    columns: [
      { header: "Jenis Peringatan", width: 38, format: "text" },
      { header: "Jumlah", width: 16, format: "number" },
    ],
    dataRows: [
      metricRow("Follow-up Terlambat", data.alerts.overdueFollowUps, NUMBER_FORMAT),
      metricRow("Follow-up Jatuh Tempo Hari Ini", data.alerts.dueTodayFollowUps, NUMBER_FORMAT),
      metricRow("Produksi Mendekati Deadline", data.alerts.approachingDeadlineCount, NUMBER_FORMAT),
      metricRow("Produksi Terlambat", data.alerts.overdueProductionCount, NUMBER_FORMAT),
      metricRow("Order Belum Lunas", data.alerts.unpaidOrdersCount, NUMBER_FORMAT),
    ],
  });

  const sheets = [
    summary,
    insights,
    trend,
    funnel,
    products,
    channels,
    pics,
    retention,
    topCustomers,
    operations,
    stages,
    alerts,
  ];
  return makePayload(sheets, `laporan-analytics-${data.period.label}`, data.period.label);
}

/* ------------------------------- Lead sources ------------------------------- */

export function buildLeadSourceWorkbookSpec(data: LeadSourceAnalyticsData): WorkbookPayload {
  const description = subtitle(data.period.label, data.actor.name);

  const summary = tableSheet({
    name: "Ringkasan Kanal",
    title: "Laporan Analisis Kanal Akuisisi",
    description,
    columns: [
      { header: "Metrik", width: 36, format: "text" },
      { header: "Nilai", width: 24, format: "number" },
      { header: "Periode Sebelumnya", width: 24, format: "number" },
      { header: "Perubahan", width: 16, format: "percent" },
    ],
    dataRows: [
      summaryRow("Total Lead", data.summary.totalLeads, data.summary.prevLeads, data.summary.leadsGrowth, "number"),
      summaryRow("Total Deal", data.summary.totalDeals, data.summary.prevDeals, data.summary.dealsGrowth, "number"),
      summaryRow("Total Omzet", data.summary.totalRevenue, data.summary.prevRevenue, data.summary.revenueGrowth, "currency"),
      summaryRow("Win Rate", data.summary.overallWinRate, data.summary.prevWinRate, data.summary.winRateGrowth, "percent"),
      summaryRow("Average Order Value", data.summary.aov, data.summary.prevAov, data.summary.aovGrowth, "currency"),
      summaryRow("Total Volume (pcs)", data.summary.totalPcs, data.summary.prevPcs, data.summary.pcsGrowth, "number"),
      summaryRow("Kanal Omzet Terbaik", data.summary.topRevenueChannel),
      summaryRow("Kanal Win Rate Terbaik", data.summary.topWinRateChannel),
      summaryRow("Kanal Volume Terbaik", data.summary.topVolumeChannel),
      summaryRow("Juara Repeat Order", data.summary.repeatOrderChampion),
    ],
    notes: ["Periode dan filter mengikuti halaman Analisis Sumber Lead saat tombol export ditekan."],
  });

  const channels = tableSheet({
    name: "Performa Kanal",
    title: "Performa Kanal Akuisisi",
    description,
    columns: [
      { header: "Kanal", width: 26, format: "text" },
      { header: "Tier", width: 18, format: "text" },
      { header: "Lead", width: 10, format: "number" },
      { header: "Deal", width: 10, format: "number" },
      { header: "Win Rate", width: 12, format: "percent" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "AOV", width: 20, format: "currency" },
      { header: "Volume (pcs)", width: 13, format: "number" },
      { header: "Lead Share", width: 12, format: "percent" },
      { header: "Revenue Share", width: 14, format: "percent" },
      { header: "Deal Share", width: 12, format: "percent" },
      { header: "Repeat Deal", width: 12, format: "number" },
      { header: "Repeat Rate", width: 12, format: "percent" },
      { header: "Deal Baru", width: 11, format: "number" },
      { header: "Siklus (hari)", width: 12, format: "decimal" },
      { header: "Top Kategori Customer", width: 24, format: "text" },
      { header: "Top Jenis Busana", width: 24, format: "text" },
      { header: "Top Kota", width: 18, format: "text" },
    ],
    dataRows: data.channels.map((channel) =>
      row([
        textCell(channel.name),
        textCell(channel.tier),
        numericCell(channel.leadCount),
        numericCell(channel.dealCount),
        numericCell(channel.winRate, PERCENT_FORMAT),
        numericCell(channel.revenue, CURRENCY_FORMAT),
        numericCell(channel.aov, CURRENCY_FORMAT),
        numericCell(channel.totalPcs),
        numericCell(channel.leadShare, PERCENT_FORMAT),
        numericCell(channel.revenueShare, PERCENT_FORMAT),
        numericCell(channel.dealShare, PERCENT_FORMAT),
        numericCell(channel.repeatDealCount),
        numericCell(channel.repeatDealRate, PERCENT_FORMAT),
        numericCell(channel.newDealCount),
        numericCell(channel.avgCycleDays, DECIMAL_FORMAT),
        textCell(channel.topCustomerCategory),
        textCell(channel.topGarmentType),
        textCell(channel.topCity),
      ]),
    ),
  });

  const timelineRows: WorkbookRow[] = [];
  for (const point of data.timeline) {
    for (const [channelName, values] of Object.entries(point.channelData)) {
      timelineRows.push(row([
        textCell(point.date),
        textCell(channelName),
        numericCell(values.leads),
        numericCell(values.deals),
        numericCell(values.revenue, CURRENCY_FORMAT),
      ]));
    }
    timelineRows.push(row([
      { value: point.date, align: "left", bold: true },
      { value: "TOTAL", align: "left", bold: true },
      { value: point.totalLeads, align: "right", bold: true, numFmt: NUMBER_FORMAT },
      { value: point.totalDeals, align: "right", bold: true, numFmt: NUMBER_FORMAT },
      { value: point.totalRevenue, align: "right", bold: true, numFmt: CURRENCY_FORMAT },
    ]));
  }

  const timeline = tableSheet({
    name: "Tren Kanal",
    title: "Tren Bulanan per Kanal",
    description,
    columns: [
      { header: "Periode", width: 14, format: "text" },
      { header: "Kanal", width: 26, format: "text" },
      { header: "Lead", width: 12, format: "number" },
      { header: "Deal", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
    ],
    dataRows: timelineRows,
    notes: ["Baris TOTAL merangkum seluruh kanal pada periode tersebut."],
  });

  const customerCategories = tableSheet({
    name: "Kategori Customer",
    title: "Distribusi Kategori Customer",
    description,
    columns: [
      { header: "Kategori Customer", width: 28, format: "text" },
      { header: "Total Order", width: 14, format: "number" },
      { header: "Total Omzet", width: 20, format: "currency" },
      { header: "Sumber Dominan", width: 24, format: "text" },
    ],
    dataRows: data.customerCategories.map((category) =>
      row([
        textCell(category.categoryName),
        numericCell(category.totalOrders),
        numericCell(category.totalRevenue, CURRENCY_FORMAT),
        textCell(category.dominantSource),
      ]),
    ),
  });

  const customerCategoryChannels: WorkbookRow[] = [];
  for (const category of data.customerCategories) {
    for (const channel of category.channels) {
      customerCategoryChannels.push(row([
        textCell(category.categoryName),
        textCell(channel.sourceName),
        numericCell(channel.orderCount),
        numericCell(channel.revenue, CURRENCY_FORMAT),
        numericCell(channel.sharePercent, PERCENT_FORMAT),
      ]));
    }
  }

  const customerCategoryBreakdown = tableSheet({
    name: "Customer per Kanal",
    title: "Kategori Customer per Kanal",
    description,
    columns: [
      { header: "Kategori Customer", width: 28, format: "text" },
      { header: "Kanal", width: 26, format: "text" },
      { header: "Order", width: 12, format: "number" },
      { header: "Omzet", width: 20, format: "currency" },
      { header: "Pangsa", width: 14, format: "percent" },
    ],
    dataRows: customerCategoryChannels,
  });

  const garments = tableSheet({
    name: "Jenis Busana",
    title: "Distribusi Jenis Busana",
    description,
    columns: [
      { header: "Jenis Busana", width: 28, format: "text" },
      { header: "Total Order", width: 14, format: "number" },
      { header: "Total Pcs", width: 14, format: "number" },
      { header: "Sumber Dominan", width: 24, format: "text" },
    ],
    dataRows: data.garmentCategories.map((garment) =>
      row([
        textCell(garment.garmentType),
        numericCell(garment.totalOrders),
        numericCell(garment.totalPcs),
        textCell(garment.dominantSource),
      ]),
    ),
  });

  const garmentChannels: WorkbookRow[] = [];
  for (const garment of data.garmentCategories) {
    for (const channel of garment.channels) {
      garmentChannels.push(row([
        textCell(garment.garmentType),
        textCell(channel.sourceName),
        numericCell(channel.orderCount),
        numericCell(channel.pcs),
        numericCell(channel.sharePercent, PERCENT_FORMAT),
      ]));
    }
  }

  const garmentBreakdown = tableSheet({
    name: "Busana per Kanal",
    title: "Jenis Busana per Kanal",
    description,
    columns: [
      { header: "Jenis Busana", width: 28, format: "text" },
      { header: "Kanal", width: 26, format: "text" },
      { header: "Order", width: 12, format: "number" },
      { header: "Pcs", width: 12, format: "number" },
      { header: "Pangsa", width: 14, format: "percent" },
    ],
    dataRows: garmentChannels,
  });

  const insights = tableSheet({
    name: "Insight & Rekomendasi",
    title: "Insight & Rekomendasi Kanal",
    description,
    columns: [
      { header: "Tipe", width: 16, format: "text" },
      { header: "Judul", width: 42, format: "text" },
      { header: "Kanal", width: 24, format: "text" },
      { header: "Penjelasan", width: 76, format: "text" },
      { header: "Rekomendasi Aksi", width: 40, format: "text" },
    ],
    dataRows: data.insights.map((insight) =>
      row([
        textCell(insightTypeLabel(insight.type)),
        textCell(insight.title),
        textCell(insight.channelName),
        textCell(insight.description),
        textCell(insight.actionText),
      ]),
    ),
  });

  const sheets = [
    summary,
    channels,
    timeline,
    customerCategories,
    customerCategoryBreakdown,
    garments,
    garmentBreakdown,
    insights,
  ];
  return makePayload(sheets, `laporan-kanal-akuisisi-${data.period.label}`, data.period.label);
}
