import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import { buildProjectProducts, productCostSeeds } from "../lib/finance/project-products.ts";
import { productCostSeedRows, hppValues } from "../scripts/lib/project-product-costs.mjs";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const costs = [
  { id: "c-kemeja", productName: "Kemeja", version: 1, kain: "100", zipper: null, jahit: null, pres: null, dtfPlastisol: null, bordir: null, lainnya: null },
  { id: "c-celana", productName: "Celana", version: 2, kain: null, zipper: null, jahit: "50", pres: null, dtfPlastisol: null, bordir: null, lainnya: null },
];

test("produk tanpa baris HPP tetap muncul dan diberi penanda costId null", () => {
  const products = buildProjectProducts({
    invoiceItems: [
      { productName: "Kemeja", quantity: 10, position: 0 },
      { productName: "Topi", quantity: 10, position: 1 },
    ],
    purchaseOrderItems: [],
    productCosts: costs,
    fallbackProductName: "Seragam",
    fallbackGarmentType: "Kemeja",
  });

  // Edit HPP tetap tersedia untuk semua produk; yang belum punya baris HPP
  // ditandai costId null dan dibuatkan barisnya oleh aksi simpan.
  assert.deepEqual(products.map((product) => [product.productName, product.costId]), [
    ["Kemeja", "c-kemeja"],
    ["Topi", null],
  ]);
  assert.equal(products[0].costVersion, 1);
  assert.equal(products[1].costVersion, null);
});

test("nama produk untuk baris HPP sama dengan nama yang dipakai tabel Project", () => {
  // Invoice tanpa nama produk memakai nama produk PO di kedua sisi.
  const products = buildProjectProducts({
    invoiceItems: [{ productName: null, quantity: 4, position: 0 }],
    purchaseOrderItems: [],
    productCosts: [{ ...costs[0], productName: "Seragam" }],
    fallbackProductName: "Seragam",
    fallbackGarmentType: "Kemeja",
  });
  assert.equal(products[0].productName, "Seragam");
  assert.equal(products[0].costId, "c-kemeja");

  const seeds = productCostSeeds([{ position: 0, productName: null }], "Seragam");
  assert.deepEqual(seeds, [{ productName: "Seragam", position: 0 }]);
});

test("seed HPP menggabungkan ukuran dan mengikuti urutan posisi invoice", () => {
  const seeds = productCostSeeds([
    { position: 0, productName: "Kemeja" },
    { position: 1, productName: "kemeja " },
    { position: 2, productName: "Celana" },
  ], "Seragam");
  assert.deepEqual(seeds, [
    { productName: "Kemeja", position: 0 },
    { productName: "Celana", position: 2 },
  ]);

  // Invoice tanpa item tetap punya satu baris agar Edit HPP tidak hilang.
  assert.deepEqual(productCostSeeds([], "Order Historis"), [{ productName: "Order Historis", position: 0 }]);
  assert.deepEqual(productCostSeeds([], null), [{ productName: "Produk", position: 0 }]);
});

test("helper script import menghasilkan baris HPP identik dengan versi aplikasi", () => {
  const items = [
    { position: 0, productName: "Kemeja" },
    { position: 1, productName: "Kemeja" },
    { position: 2, productName: "Celana" },
  ];
  assert.deepEqual(productCostSeedRows(items, "Seragam"), productCostSeeds(items, "Seragam"));
  assert.deepEqual(hppValues({ kain: 100, zipper: 0, jahit: 50 }), { kain: "100", jahit: "50" });
});

test("migrasi backfill mengisi baris HPP yang hilang tanpa mengubah agregat", async () => {
  const migration = await read("prisma/migrations/20261029150000_backfill_sales_order_product_cost/migration.sql");

  // Guard order yang belum punya baris HPP agar distribusi agregat tidak dobel.
  assert.match(migration, /CREATE TEMP TABLE "_orders_without_product_cost" ON COMMIT DROP/);
  assert.match(migration, /JOIN "_orders_without_product_cost" ow/);
  // Idempoten.
  assert.match(migration, /ON CONFLICT \("salesOrderId", "productName"\) DO NOTHING/);
  // Nama produk mengikuti tabel Project: item invoice → produk PO → Produk.
  assert.match(migration, /COALESCE\(NULLIF\(BTRIM\(ii\."productName"\), ''\), NULLIF\(BTRIM\(po\."productName"\), ''\), 'Produk'\)/);
  // Agregat hanya disalin, tidak pernah dihapus.
  assert.doesNotMatch(migration, /DELETE FROM/i);
  assert.doesNotMatch(migration, /UPDATE "SalesOrderCost"/);
  // Expense HPP lama ditautkan agar prefill Edit HPP tidak hilang.
  assert.match(migration, /"salesOrderProductCostId" = chosen.id/);
  // Prisma tidak membungkus migrasi PostgreSQL dalam transaksi, sedangkan tabel
  // sementara butuh satu transaksi. Tanpa BEGIN/COMMIT, migrate deploy gagal
  // dengan "relation _orders_without_product_cost does not exist".
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;\s*$/);
});

test("script backfill melewati BEGIN/COMMIT karena sudah membungkus transaksi sendiri", async () => {
  const script = await read("scripts/backfill-project-product-costs.mjs");
  assert.match(script, /\^\(BEGIN\|COMMIT\|ROLLBACK\)\$/i);
});

test("script backfill memakai SQL migrasi dan default dry-run", async () => {
  const script = await read("scripts/backfill-project-product-costs.mjs");
  assert.match(script, /prisma\/migrations\/20261029150000_backfill_sales_order_product_cost\/migration\.sql/);
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /if \(!apply\) \{/);
  assert.match(script, /await tx\.\$executeRawUnsafe\(statement\)/);
});

test("aksi simpan HPP membuat baris produk yang belum ada", async () => {
  const [actions, form, page] = await Promise.all([
    read("app/actions/finance.ts"),
    read("components/finance/sales-order-cost-form.tsx"),
    read("app/(app)/keuangan/pemasukan/page.tsx"),
  ]);

  // Form mengirim identitas produk sehingga baris bisa dibuat dari nama.
  assert.match(form, /<input type="hidden" name="productCostId" value=\{item\.productCostId \?\? ""\} \/>/);
  assert.match(form, /<input type="hidden" name="salesOrderId" value=\{item\.id\} \/>/);
  assert.match(form, /<input type="hidden" name="productName" value=\{item\.productName\} \/>/);

  // Halaman tidak lagi menyembunyikan tombol Edit HPP.
  assert.doesNotMatch(page, /: <span className="text-muted-foreground">-<\/span>\}<\/TableCell>\s*\n\s*<\/TableRow>/);
  assert.match(page, /<SalesOrderCostForm item=\{\{ id: item\.id, productCostId: product\.costId/);

  // Aksi: cari baris berdasarkan (salesOrderId, productName), buat bila belum ada,
  // dan tetap memakai optimistic lock untuk baris yang sudah ada.
  assert.match(actions, /salesOrderId: z\.preprocess\(blankToUndefined, z\.string\(\)\.trim\(\)\.max\(64\)\.optional\(\)\)/);
  assert.match(actions, /productName: z\.preprocess\(blankToUndefined, z\.string\(\)\.trim\(\)\.max\(120\)\.optional\(\)\)/);
  assert.match(actions, /where: productCostId \? \{ id: productCostId \} : \{ salesOrderId_productName/);
  assert.match(actions, /tx\.salesOrderProductCost\.create\(\{/);
  assert.match(actions, /error\.code !== "P2002"/);
  assert.match(actions, /const result = await tx\.salesOrderProductCost\.updateMany\(\{\s*where: \{ id: resolvedProductCostId, salesOrder: \{ status: "ACTIVE" \}, \.\.\.\(existing \? \{ version \} : \{\}\) \},/);
});
