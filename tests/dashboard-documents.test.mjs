import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dataSource, dashboardDataSource, dashboardSource] = await Promise.all([
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/dashboard-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/dashboard/dashboard-content-client.tsx", import.meta.url), "utf8"),
]);
const [permissionsSource, loginSource, authActionsSource, navSource, dashboardPageSource] = await Promise.all([
  readFile(new URL("../lib/auth/permissions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/auth.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8"),
]);

function queryBlock(model) {
  const start = dataSource.indexOf(`prisma.${model}.findMany({`, dataSource.indexOf("export async function getSalesDashboardData"));
  const end = dataSource.indexOf("take: documentPreviewLimit", start);

  assert.notEqual(start, -1, `Query ${model} dashboard harus tersedia`);
  assert.notEqual(end, -1, `Query ${model} dashboard harus memakai batas preview`);
  return dataSource.slice(start, end + "take: documentPreviewLimit".length);
}

test("dashboard membatasi PO dan invoice terbaru menjadi lima item", () => {
  assert.match(dataSource, /const documentPreviewLimit = 5;/);

  for (const model of ["purchaseOrder", "invoice"]) {
    const block = queryBlock(model);
    assert.match(block, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "asc" \}\]/);
    assert.doesNotMatch(block, /where:/, `${model} tidak boleh menyaring status revisi`);
  }
});

test("payload dokumen dashboard aman untuk serialisasi client", () => {
  assert.match(dataSource, /latestPurchaseOrders: latestPurchaseOrders\.map/);
  assert.match(dataSource, /latestInvoices: latestInvoices\.map/);
  assert.match(dataSource, /createdAt: item\.createdAt\.toISOString\(\)/);
  assert.match(dataSource, /total: item\.total\.toString\(\)/);
});

// Dashboard baru menampilkan order terbaru (bukan preview PO/invoice seperti desain lama).
test("dashboard menampilkan order terbaru dengan tautan ke sales order", () => {
  assert.match(dashboardSource, /Order Terbaru/);
  assert.match(dashboardSource, /data\.recentOrders\.map/);
  assert.match(dashboardSource, /href="\/crm\/sales-orders"/);
  assert.match(dashboardSource, /Lihat Semua/);
});

test("query dashboard tetap memeriksa aktor sebelum membaca data", () => {
  assert.match(dataSource, /export async function getSalesDashboardData\(\) \{\s+const actor = await requireActor\(DASHBOARD_ROLES\);\s+const prisma/);
});

test("Keuangan dapat membuka Dashboard tanpa membuka CRM", () => {
  // D1: dashboard ikut CRM_VIEW_ROLES sehingga Admin PO (read-only) juga bisa membuka.
  assert.match(permissionsSource, /DASHBOARD_ROLES = \[\.\.\.CRM_VIEW_ROLES, "KEUANGAN"\]/);
  assert.match(navSource, /const canViewDashboard = canViewCrm \|\| role === "KEUANGAN"/);
  assert.match(navSource, /\{canViewDashboard \? mainItems\.map/);
  assert.doesNotMatch(loginSource, /role === "KEUANGAN" \? "\/keuangan"/);
  assert.doesNotMatch(authActionsSource, /role === "KEUANGAN" \? "\/keuangan"/);
});

test("dashboard tidak lagi menampilkan card dan tombol follow-up mendesak", () => {
  assert.doesNotMatch(dashboardSource, /Follow-up mendesak/);
  assert.doesNotMatch(dashboardSource, /data\.overdue/);
  assert.doesNotMatch(dashboardSource, /data\.dueToday/);
  assert.doesNotMatch(dashboardPageSource, /Buka Follow-up/);
  assert.doesNotMatch(dashboardPageSource, /canOpenFollowUp/);
});

test("card AOV dihapus dari baris hasil sales", () => {
  assert.doesNotMatch(dashboardSource, /label="AOV"/);
  assert.doesNotMatch(dashboardSource, /Rata-rata Nilai Order/);
  // Catatan: ikon Wallet kini dipakai di menu pencarian & kartu arus kas, bukan kartu AOV.
});

test("data finansial dashboard hanya dikirim ke peran Keuangan", () => {
  assert.match(dashboardDataSource, /const canViewFinancialData = hasRole\(actor\.role, FINANCE_ROLES\)/);
  assert.match(dashboardDataSource, /return canViewFinancialData \? payload : maskFinancialData\(payload\)/);
  // Nilai uang diganti placeholder sebelum dikirim ke client non-Keuangan.
  assert.match(dashboardDataSource, /totalOmzet: MASKED_MONEY/);
  assert.match(dashboardDataSource, /moneyInThisMonth: MASKED_MONEY/);
  assert.match(dashboardDataSource, /canViewFinancialData: boolean/);
  assert.match(dashboardSource, /const canViewFinancialData = data\.canViewFinancialData/);
  assert.match(dashboardSource, /canViewFinancialData && \(/);
  assert.match(dashboardSource, /Kesehatan Arus Kas & Piutang/);
  // Owner & Developer selalu lolos lewat hasRole.
  assert.match(permissionsSource, /role === "DEVELOPER" \|\| role === "OWNER"/);
});
