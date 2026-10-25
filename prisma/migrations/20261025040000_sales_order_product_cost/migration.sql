-- HPP per produk. SalesOrderCost tetap menjadi agregat order + status hppComplete.
CREATE TABLE "SalesOrderProductCost" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "productName" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "kain" DECIMAL(18,2),
  "zipper" DECIMAL(18,2),
  "jahit" DECIMAL(18,2),
  "pres" DECIMAL(18,2),
  "dtfPlastisol" DECIMAL(18,2),
  "bordir" DECIMAL(18,2),
  "lainnya" DECIMAL(18,2),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrderProductCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOrderProductCost_salesOrderId_productName_key"
  ON "SalesOrderProductCost"("salesOrderId", "productName");
CREATE INDEX "SalesOrderProductCost_salesOrderId_position_idx"
  ON "SalesOrderProductCost"("salesOrderId", "position");
CREATE INDEX "SalesOrderProductCost_updatedAt_idx"
  ON "SalesOrderProductCost"("updatedAt");

ALTER TABLE "Expense" ADD COLUMN "salesOrderProductCostId" TEXT;
CREATE INDEX "Expense_salesOrderProductCostId_hppKey_idx"
  ON "Expense"("salesOrderProductCostId", "hppKey");

-- Backfill satu baris HPP untuk setiap produk dalam Sales Order. Nama produk
-- mengikuti InvoiceItem; data lama tanpa productName memakai nama produk PO.
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

-- HPP lama hanya tersimpan di level order. Tempatkan seluruh nilai lama pada
-- produk yang namanya cocok dengan PurchaseOrder.productName; jika tidak ada,
-- produk pertama. Total HPP order tidak berubah dan dapat dipecah lewat UI.
WITH chosen AS (
  SELECT DISTINCT ON (pc."salesOrderId") pc.id, pc."salesOrderId"
  FROM "SalesOrderProductCost" pc
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

-- Expense HPP lama ikut ditempatkan pada produk yang menerima HPP lama agar
-- prefill Edit HPP per produk tidak kehilangan baris.
WITH chosen AS (
  SELECT DISTINCT ON (pc."salesOrderId") pc.id, pc."salesOrderId"
  FROM "SalesOrderProductCost" pc
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

ALTER TABLE "SalesOrderProductCost"
  ADD CONSTRAINT "SalesOrderProductCost_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_salesOrderProductCostId_fkey"
  FOREIGN KEY ("salesOrderProductCostId") REFERENCES "SalesOrderProductCost"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
