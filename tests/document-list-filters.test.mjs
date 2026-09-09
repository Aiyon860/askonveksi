import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDocumentDateRange } from "../lib/crm/document-list-filters.ts";

const reference = new Date("2026-09-08T06:00:00.000Z");

const [dataSource, purchaseOrderPage, invoicePage, salesOrderPage] = await Promise.all([
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/crm/purchase-orders/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/crm/invoices/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/crm/sales-orders/page.tsx", import.meta.url), "utf8"),
]);

test("rentang dokumen memakai batas hari Jakarta yang inklusif", () => {
  const range = parseDocumentDateRange("2026-09-05", "2026-09-07", reference);

  assert.equal(range.start?.toISOString(), "2026-09-04T17:00:00.000Z");
  assert.equal(range.end?.toISOString(), "2026-09-07T17:00:00.000Z");
});

test("tanggal akhir kosong memakai hari ini di Jakarta", () => {
  const range = parseDocumentDateRange("2026-09-05", undefined, reference);

  assert.equal(range.to, "2026-09-08");
  assert.equal(range.end?.toISOString(), "2026-09-08T17:00:00.000Z");
});

test("rentang kosong, palsu, terbalik, atau masa depan tidak aktif", () => {
  for (const [from, to] of [
    [undefined, undefined],
    ["2026-02-30", "2026-09-08"],
    ["2026-09-08", "2026-09-07"],
    ["2026-09-08", "2026-09-09"],
  ]) {
    assert.equal(parseDocumentDateRange(from, to, reference).start, null);
  }
});

test("default daftar dokumen tidak membuang status yang digantikan", () => {
  assert.equal(dataSource.match(/\.\.\.\(status === "all" \? \{\} : \{ status \}\)/g)?.length, 3);
  assert.match(purchaseOrderPage, /value="SUPERSEDED">Digantikan/);
  assert.match(invoicePage, /value="SUPERSEDED">Digantikan/);
  assert.match(salesOrderPage, /value="CANCELLED">Dibatalkan/);
});
