import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

const [
  route,
  spec,
  runner,
  analysisRunner,
  button,
  dashboard,
  analytics,
  leadSources,
  buildXlsx,
  buildWorkbook,
  worker,
  workbookTypes,
] = await Promise.all([
  readFile(new URL("app/api/export/analysis-workbook/route.ts", root), "utf8"),
  readFile(new URL("lib/export/analysis-workbook-spec.ts", root), "utf8"),
  readFile(new URL("lib/export/run-finance-workbook.ts", root), "utf8"),
  readFile(new URL("lib/export/run-analysis-workbook.ts", root), "utf8"),
  readFile(new URL("components/export/export-button.tsx", root), "utf8"),
  readFile(new URL("components/dashboard/dashboard-content-client.tsx", root), "utf8"),
  readFile(new URL("components/analytics/analytics-content-client.tsx", root), "utf8"),
  readFile(new URL("components/analytics/lead-sources/lead-sources-content-client.tsx", root), "utf8"),
  readFile(new URL("lib/export/build-xlsx.ts", root), "utf8"),
  readFile(new URL("lib/export/build-workbook.ts", root), "utf8"),
  readFile(new URL("public/export-worker.js", root), "utf8"),
  readFile(new URL("lib/export/workbook-types.ts", root), "utf8"),
]);

test("scope analysis workbook mencakup dashboard, analytics, dan kanal akuisisi", () => {
  assert.match(workbookTypes, /export type AnalysisWorkbookScope = "dashboard" \| "analytics" \| "lead-sources"/);
  assert.match(route, /value === "dashboard" \|\| value === "analytics" \|\| value === "lead-sources"/);
});

test("route analysis workbook memakai sesi, role halaman, dan builder multi-sheet", () => {
  assert.match(route, /getCurrentActor/);
  assert.match(route, /hasRole/);
  assert.match(route, /DASHBOARD_ROLES/);
  assert.match(route, /ANALYTICS_ROLES/);
  assert.match(route, /buildDashboardWorkbookSpec/);
  assert.match(route, /buildExecutiveAnalyticsWorkbookSpec/);
  assert.match(route, /buildLeadSourceWorkbookSpec/);
  assert.match(route, /getDashboardFullAnalyticsData/);
  assert.match(route, /getExecutiveAnalyticsData/);
  assert.match(route, /getLeadSourceAnalyticsData/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /writeBuffer|new ExcelJS\.Workbook/);
});

test("runner analisis memakai worker workbook yang sama dengan laporan keuangan", () => {
  assert.match(analysisRunner, /runWorkbookExport/);
  assert.match(analysisRunner, /\/api\/export\/analysis-workbook/);
  assert.match(runner, /export async function runWorkbookExport/);
  assert.match(runner, /startWorkbookWorker/);
  assert.match(runner, /WorkerUnavailableError/);
  assert.match(runner, /buildWorkbookSpec/);
  assert.match(runner, /saveBytes/);
  assert.match(runner, /downloadFilename\(payload\.subject, "xlsx"\)/);
  assert.match(runner, /payload\.rowCount === 0/);
});

test("ExportButton mendukung analysisScope tanpa merusak alur finance", () => {
  assert.match(button, /runAnalysisWorkbookExport/);
  assert.match(button, /runFinanceWorkbookExport/);
  assert.match(button, /analysisScope\?: AnalysisWorkbookScope/);
  assert.match(button, /workbookScope\?: FinanceWorkbookScope/);
  assert.match(button, /"workbookScope" in target/);
  assert.match(button, /"analysisScope" in target/);
  assert.match(button, /item\.workbookScope/);
  assert.match(button, /item\.analysisScope/);
  assert.match(button, /dataset\?: string/);
  assert.match(button, /runExcelExport/);
});

test("dashboard, analytics, dan kanal akuisisi memakai export workbook Excel", () => {
  assert.match(dashboard, /<ExportButton[\s\S]*analysisScope="dashboard"/);
  assert.doesNotMatch(dashboard, /handleExportCSV/);
  assert.match(analytics, /<ExportButton[\s\S]*analysisScope="analytics"/);
  assert.doesNotMatch(analytics, /handleExportCsv/);
  assert.match(leadSources, /<ExportButton[\s\S]*analysisScope="lead-sources"/);
});

test("spec analisis menyediakan sheet rinci dan header berwarna", () => {
  assert.match(spec, /export function buildDashboardWorkbookSpec/);
  assert.match(spec, /export function buildExecutiveAnalyticsWorkbookSpec/);
  assert.match(spec, /export function buildLeadSourceWorkbookSpec/);
  assert.match(spec, /name: "Ringkasan Eksekutif"/);
  assert.match(spec, /name: "Insight & Rekomendasi"/);
  assert.match(spec, /name: "Funnel Konversi"/);
  assert.match(spec, /name: "Produk & Margin"/);
  assert.match(spec, /name: "Kanal Akuisisi"/);
  assert.match(spec, /name: "Performa Kanal"/);
  assert.match(spec, /name: "Top Customer"/);
  assert.match(spec, /fill: COLORS\.header/);
  assert.match(spec, /color: COLORS\.white/);
  assert.match(spec, /autoFilter/);
  assert.match(spec, /filter\.toRow - filter\.fromRow/);
  assert.match(spec, /printTitlesRow: "4:4"/);
  assert.match(spec, /CURRENCY_FORMAT/);
  assert.match(spec, /PERCENT_FORMAT/);
});

test("export dataset generik memakai header berwarna dan lebar kolom otomatis", () => {
  assert.match(buildXlsx, /HEADER_FILL = "FF1F4E78"/);
  assert.match(buildXlsx, /color: \{ argb: "FFFFFFFF" \}/);
  assert.match(buildXlsx, /function columnWidth/);
  assert.match(buildXlsx, /function wrappedLines/);
  assert.match(buildXlsx, /sheet\.mergeCells\(noteRow\.number/);
  assert.match(buildXlsx, /sheet\.autoFilter = \{/);
  assert.match(buildXlsx, /totalRowNumber/);
  assert.doesNotMatch(buildXlsx, /to: \{ row: 1, column: init\.columns\.length \}/);
});

test("worker export tetap sinkron dengan builder: header, autofit, dan filter", () => {
  assert.match(worker, /var HEADER_FILL = "FF1F4E78"/);
  assert.match(worker, /function styleGenericHeader/);
  assert.match(worker, /function applyGenericLayout/);
  assert.match(worker, /function autoFitWorkbookSheet/);
  assert.match(worker, /state\.widths/);
  assert.match(worker, /state\.totalRowNumber/);
  assert.match(worker, /mergeCells\(noteRow\.number/);
  assert.match(worker, /to: \{ row: Math\.max\(1, state\.totalRowNumber/);
});

test("workbook builder melebarkan kolom tanpa mengubah sel gabungan", () => {
  assert.match(buildWorkbook, /function autoFitWorkbookSheet/);
  assert.match(buildWorkbook, /function parseMergeRange/);
  assert.match(buildWorkbook, /function isInsideMerges/);
  assert.match(buildWorkbook, /MAX_COLUMN_WIDTH = 70/);
  assert.match(buildWorkbook, /autoFitWorkbookSheet\(sheet, spec\)/);
  assert.match(buildWorkbook, /wrapText: true/);
});
