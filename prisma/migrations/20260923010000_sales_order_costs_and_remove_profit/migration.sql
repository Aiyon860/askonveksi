BEGIN;

CREATE TABLE "SalesOrderCost" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "kain" DECIMAL(18,2),
  "zipper" DECIMAL(18,2),
  "jahit" DECIMAL(18,2),
  "pres" DECIMAL(18,2),
  "dtfPlastisol" DECIMAL(18,2),
  "bordir" DECIMAL(18,2),
  "lainnya" DECIMAL(18,2),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SalesOrderCost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesOrderCost_values_nonnegative" CHECK (
    ("kain" IS NULL OR "kain" >= 0) AND
    ("zipper" IS NULL OR "zipper" >= 0) AND
    ("jahit" IS NULL OR "jahit" >= 0) AND
    ("pres" IS NULL OR "pres" >= 0) AND
    ("dtfPlastisol" IS NULL OR "dtfPlastisol" >= 0) AND
    ("bordir" IS NULL OR "bordir" >= 0) AND
    ("lainnya" IS NULL OR "lainnya" >= 0) AND
    "version" > 0
  )
);

CREATE UNIQUE INDEX "SalesOrderCost_salesOrderId_key" ON "SalesOrderCost"("salesOrderId");
CREATE INDEX "SalesOrderCost_updatedAt_idx" ON "SalesOrderCost"("updatedAt");
ALTER TABLE "SalesOrderCost" ADD CONSTRAINT "SalesOrderCost_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderCost" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SalesOrderCost" FROM anon, authenticated;

INSERT INTO "SalesOrderCost" ("id", "salesOrderId", "updatedAt")
SELECT 'sales-order-cost-' || "id", "id", CURRENT_TIMESTAMP FROM "SalesOrder"
ON CONFLICT ("salesOrderId") DO NOTHING;

-- The former constraint includes profit in the line totals. Remove it before
-- normalizing legacy lines, then restore the equivalent no-profit invariant.
ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_charges_valid";

UPDATE "InvoiceItem"
SET
  "discountCapAmount" = NULL,
  "profitPercent" = 0,
  "profitAmount" = 0,
  "discountAmount" = ROUND("grossAmount" * "discountPercent" / 100, 2),
  "total" = "grossAmount" - ROUND("grossAmount" * "discountPercent" / 100, 2),
  "subtotal" = "grossAmount" - ROUND("grossAmount" * "discountPercent" / 100, 2);

ALTER TABLE "SalesOrderItem" DROP CONSTRAINT IF EXISTS "SalesOrderItem_values_valid";

UPDATE "SalesOrderItem"
SET
  "discountCapAmount" = NULL,
  "profitPercent" = 0,
  "profitAmount" = 0,
  "discountAmount" = ROUND("grossAmount" * "discountPercent" / 100, 2),
  "total" = "grossAmount" - ROUND("grossAmount" * "discountPercent" / 100, 2),
  "subtotal" = "grossAmount" - ROUND("grossAmount" * "discountPercent" / 100, 2);

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_charges_valid" CHECK (
  "grossAmount" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND
  "discountCapAmount" IS NULL AND "discountAmount" >= 0 AND
  "profitPercent" = 0 AND "profitAmount" = 0 AND "total" >= 0 AND
  "grossAmount" = ROUND("quantity" * "unitPrice", 2) AND
  "discountAmount" = ROUND("grossAmount" * "discountPercent" / 100, 2) AND
  "total" = "grossAmount" - "discountAmount" AND "subtotal" = "total"
);

ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_values_valid" CHECK (
  "position" >= 0 AND "quantity" > 0 AND "unitPrice" >= 0 AND
  "grossAmount" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND
  "discountCapAmount" IS NULL AND "discountAmount" >= 0 AND
  "profitPercent" = 0 AND "profitAmount" = 0 AND "total" >= 0 AND
  "grossAmount" = ROUND("quantity" * "unitPrice", 2) AND
  "discountAmount" = ROUND("grossAmount" * "discountPercent" / 100, 2) AND
  "total" = "grossAmount" - "discountAmount" AND "subtotal" = "total"
);

UPDATE "Invoice" SET "totalProfit" = 0;

COMMIT;
