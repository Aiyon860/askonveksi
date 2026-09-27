import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dataSource, dashboardSource] = await Promise.all([
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
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

test("preview dokumen menyediakan detail, tautan lengkap, dan empty state", () => {
  assert.match(dashboardSource, /triggerVariant="preview"/);
  assert.match(dashboardSource, /href="\/crm\/purchase-orders"/);
  assert.match(dashboardSource, /href="\/crm\/invoices"/);
  assert.match(dashboardSource, /Belum ada purchase order/);
  assert.match(dashboardSource, /Belum ada invoice/);
});

test("query dashboard tetap memeriksa aktor sebelum membaca data", () => {
  assert.match(dataSource, /export async function getSalesDashboardData\(\) \{\s+const actor = await requireActor\(DASHBOARD_ROLES\);\s+const prisma/);
});

test("Keuangan dapat membuka Dashboard tanpa membuka CRM", () => {
  assert.match(permissionsSource, /DASHBOARD_ROLES = \[\.\.\.CRM_ROLES, "KEUANGAN"\]/);
  assert.match(navSource, /const canViewDashboard = canViewCrm \|\| role === "KEUANGAN"/);
  assert.match(navSource, /\{canViewDashboard \? mainItems\.map/);
  assert.doesNotMatch(loginSource, /role === "KEUANGAN" \? "\/keuangan"/);
  assert.doesNotMatch(authActionsSource, /role === "KEUANGAN" \? "\/keuangan"/);
});

test("tombol Follow-up Dashboard hanya untuk Owner dan Admin Customer", () => {
  assert.match(dashboardPageSource, /actor\?\.role === "OWNER" \|\| actor\?\.role === "ADMIN_CUSTOMER"/);
  assert.match(dashboardPageSource, /action=\{canOpenFollowUp \?/);
});

test("data finansial dashboard hanya dikirim ke peran Keuangan", () => {
  assert.match(dataSource, /const canViewFinancialData = hasRole\(actor\.role, FINANCE_ROLES\)/);
  assert.match(dataSource, /canViewFinancialData \? prisma\.salesOrder\.aggregate/);
  assert.match(dataSource, /dealRevenue: dealRevenue\?\._sum\.total\?\.toString\(\) \?\? null/);
  assert.match(dashboardSource, /\{data\.canViewFinancialData \? <Card/);
  assert.match(dashboardSource, /\{data\.canViewFinancialData && data\.businessKpis \? \(/);
});
