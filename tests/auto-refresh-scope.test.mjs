import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AUTO_REFRESH_ROUTES, isAutoRefreshRoute } from "../lib/auto-refresh.ts";

const componentSource = await readFile(new URL("../components/auto-refresh.tsx", import.meta.url), "utf8");

test("grup WhatsApp dan master data tidak ikut auto-refresh", () => {
  const excluded = [
    "/whatsapp",
    "/whatsapp/jobs",
    "/master-data",
    "/master-data/business-profile",
    "/master-data/customer-types",
    "/master-data/garment-sizes",
    "/master-data/invoice-settings",
    "/master-data/lead-sources",
    "/master-data/payment-methods",
    "/master-data/product-categories",
    "/master-data/whatsapp/accounts",
    "/master-data/whatsapp/templates",
  ];

  for (const pathname of excluded) {
    assert.equal(isAutoRefreshRoute(pathname), false, `${pathname} seharusnya tanpa auto-refresh`);
  }
});

test("halaman dengan form/checkbox/dialog tidak ikut auto-refresh", () => {
  const excluded = [
    "/absensi",
    "/absensi/laporan",
    "/admin/users",
    "/campaigns",
    "/crm",
    "/crm/follow-up",
    "/crm/invoices",
    "/crm/peluang/abc",
    "/crm/prospek",
    "/crm/purchase-orders",
    "/crm/sales-orders",
    "/customers",
    "/customers/abc",
    "/detail-desain",
    "/detail-desain/wo-1",
    "/keuangan/laporan",
    "/keuangan/pemasukan",
    "/keuangan/pengeluaran",
    "/keuangan/pengeluaran/riwayat",
    "/produksi/abc",
    "/sales-orders/abc",
    "/settings",
  ];

  for (const pathname of excluded) {
    assert.equal(isAutoRefreshRoute(pathname), false, `${pathname} seharusnya tanpa auto-refresh`);
  }
});

test("halaman monitoring tetap ikut auto-refresh", () => {
  for (const pathname of ["/dashboard", "/analytics", "/analytics/lead-sources", "/produksi", "/keuangan", "/log-aktivitas"]) {
    assert.equal(isAutoRefreshRoute(pathname), true, `${pathname} seharusnya auto-refresh`);
  }
});

test("daftar rute auto-refresh tetap kecil dan eksplisit", () => {
  assert.deepEqual([...AUTO_REFRESH_ROUTES], [
    "/dashboard",
    "/analytics",
    "/analytics/lead-sources",
    "/produksi",
    "/keuangan",
    "/log-aktivitas",
  ]);
});

test("trailing slash dan path kosong ditangani", () => {
  assert.equal(isAutoRefreshRoute("/dashboard/"), true);
  assert.equal(isAutoRefreshRoute("/master-data/"), false);
  assert.equal(isAutoRefreshRoute(""), false);
  assert.equal(isAutoRefreshRoute(null), false);
  assert.equal(isAutoRefreshRoute(undefined), false);
});

test("AutoRefresh memakai daftar rute dan berhenti saat user sedang mengisi", () => {
  assert.match(componentSource, /usePathname\(\)/);
  assert.match(componentSource, /isAutoRefreshRoute\(pathname\)/);
  assert.match(componentSource, /if \(!enabled\) return;/);
  assert.match(componentSource, /data-auto-refresh-pause/);
  assert.match(componentSource, /isUserBusy\(\)/);
});
