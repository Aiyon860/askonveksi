-- Backfill HPP per produk untuk Sales Order yang belum punya baris
-- "SalesOrderProductCost". Order hasil impor historis (scripts/import-*.mjs) dan
-- order lama hanya punya agregat di "SalesOrderCost", sehingga tabel Project
-- tidak menampilkan Edit HPP per produk. Migrasi ini idempoten: aman diulang.
--
-- Prisma tidak membungkus migrasi PostgreSQL dalam transaksi, sedangkan di sini
-- dipakai tabel sementara ON COMMIT DROP, jadi transaksinya eksplisit. Script
-- scripts/backfill-project-product-costs.mjs membungkus sendiri dan melewati
-- BEGIN/COMMIT ini.

BEGIN;

-- (1) Snapshot order yang belum punya baris HPP sama sekali. Distribusi agregat
-- hanya boleh terjadi untuk order ini agar migrasi ulang tidak menjumlahkan
-- nilai yang sama dua kali.
CREATE TEMP TABLE "_orders_without_product_cost" ON COMMIT DROP AS
SELECT so.id AS "salesOrderId"
FROM "SalesOrder" so
WHERE NOT EXISTS (
  SELECT 1 FROM "SalesOrderProductCost" pc WHERE pc."salesOrderId" = so.id
);

-- (2) Satu baris HPP per nama produk invoice. Nama mengikuti kolom yang dipakai
-- tabel Project: nama item invoice → nama produk PO → 'Produk'.
INSERT INTO "SalesOrderProductCost" ("id", "salesOrderId", "productName", "position")
SELECT
  md5(random()::text || clock_timestamp()::text || src."salesOrderId" || src."productName"),
  src."salesOrderId",
  src."productName",
  src."position"
FROM (
  SELECT
    so.id AS "salesOrderId",
    COALESCE(NULLIF(BTRIM(ii."productName"), ''), NULLIF(BTRIM(po."productName"), ''), 'Produk') AS "productName",
    MIN(COALESCE(ii."position", 0)) AS "position"
  FROM "SalesOrder" so
  JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
  JOIN "_orders_without_product_cost" ow ON ow."salesOrderId" = so.id
  LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = so."invoiceId"
  GROUP BY so.id, COALESCE(NULLIF(BTRIM(ii."productName"), ''), NULLIF(BTRIM(po."productName"), ''), 'Produk')
) src
ON CONFLICT ("salesOrderId", "productName") DO NOTHING;

-- (3) Order yang sudah punya sebagian baris (mis. produk baru setelah order
-- berjalan): lengkapi nama produk yang belum punya baris.
INSERT INTO "SalesOrderProductCost" ("id", "salesOrderId", "productName", "position")
SELECT
  md5(random()::text || clock_timestamp()::text || src."salesOrderId" || src."productName"),
  src."salesOrderId",
  src."productName",
  src."position"
FROM (
  SELECT
    so.id AS "salesOrderId",
    COALESCE(NULLIF(BTRIM(ii."productName"), ''), NULLIF(BTRIM(po."productName"), ''), 'Produk') AS "productName",
    MIN(COALESCE(ii."position", 0)) AS "position"
  FROM "SalesOrder" so
  JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
  LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = so."invoiceId"
  GROUP BY so.id, COALESCE(NULLIF(BTRIM(ii."productName"), ''), NULLIF(BTRIM(po."productName"), ''), 'Produk')
) src
ON CONFLICT ("salesOrderId", "productName") DO NOTHING;

-- (4) HPP lama hanya tersimpan di level order. Tempatkan nilainya pada baris
-- produk yang namanya cocok dengan PurchaseOrder.productName; jika tidak ada,
-- baris pertama. Total HPP order tidak berubah.
WITH chosen AS (
  SELECT DISTINCT ON (pc."salesOrderId") pc.id, pc."salesOrderId"
  FROM "SalesOrderProductCost" pc
  JOIN "_orders_without_product_cost" ow ON ow."salesOrderId" = pc."salesOrderId"
  JOIN "SalesOrder" so ON so.id = pc."salesOrderId"
  JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
  ORDER BY
    pc."salesOrderId",
    CASE WHEN LOWER(BTRIM(pc."productName")) = LOWER(BTRIM(po."productName")) THEN 0 ELSE 1 END,
    pc."position",
    pc."productName"
)
UPDATE "SalesOrderProductCost" pc
SET
  "kain" = c."kain",
  "zipper" = c."zipper",
  "jahit" = c."jahit",
  "pres" = c."pres",
  "dtfPlastisol" = c."dtfPlastisol",
  "bordir" = c."bordir",
  "lainnya" = c."lainnya",
  "updatedAt" = CURRENT_TIMESTAMP
FROM chosen, "SalesOrderCost" c
WHERE pc.id = chosen.id AND c."salesOrderId" = chosen."salesOrderId";

-- (5) Expense HPP lama milik order yang baru dibackfill ikut ditempatkan pada
-- baris di atas agar riwayatnya muncul sebagai prefill di dialog Edit HPP.
WITH chosen AS (
  SELECT DISTINCT ON (pc."salesOrderId") pc.id, pc."salesOrderId"
  FROM "SalesOrderProductCost" pc
  JOIN "_orders_without_product_cost" ow ON ow."salesOrderId" = pc."salesOrderId"
  JOIN "SalesOrder" so ON so.id = pc."salesOrderId"
  JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
  ORDER BY
    pc."salesOrderId",
    CASE WHEN LOWER(BTRIM(pc."productName")) = LOWER(BTRIM(po."productName")) THEN 0 ELSE 1 END,
    pc."position",
    pc."productName"
)
UPDATE "Expense" e
SET "salesOrderProductCostId" = chosen.id
FROM chosen
WHERE e."salesOrderId" = chosen."salesOrderId"
  AND e.category = 'PROJECT'
  AND e."salesOrderProductCostId" IS NULL;

COMMIT;
