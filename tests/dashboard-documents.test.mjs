import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dataSource, dashboardSource] = await Promise.all([
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/dashboard/dashboard-content-client.tsx", import.meta.url), "utf8"),
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
  assert.match(dataSource, /export async function getSalesDashboardData\(\) \{\s+const actor = await requireActor\(\);\s+const prisma/);
});
