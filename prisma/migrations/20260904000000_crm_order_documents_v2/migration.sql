BEGIN;

CREATE TYPE "GarmentType" AS ENUM ('JERSEY', 'NON_JERSEY');
CREATE TYPE "SleeveLength" AS ENUM ('PENDEK', 'PANJANG');
CREATE TYPE "PurchaseOrderAttachmentKind" AS ENUM ('MAIN_DESIGN', 'FRONT', 'BACK', 'LOGO_RIGHT', 'LOGO_BACK', 'LOGO_FRONT', 'OTHER');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('ACTIVE', 'VOIDED');

CREATE TABLE "GarmentSize" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "description" VARCHAR(500),
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "GarmentSize_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GarmentSize_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "GarmentSize_name_not_blank" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "GarmentSize_name_key" ON "GarmentSize"("name");
CREATE UNIQUE INDEX "GarmentSize_name_ci_key" ON "GarmentSize"(LOWER(BTRIM("name")));
CREATE INDEX "GarmentSize_isActive_position_name_idx" ON "GarmentSize"("isActive", "position", "name");

INSERT INTO "GarmentSize" ("id", "name", "description", "position", "isActive", "createdAt", "updatedAt") VALUES
  ('garment-size-xs', 'XS', 'Ukuran standar XS', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-s', 'S', 'Ukuran standar S', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-m', 'M', 'Ukuran standar M', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-l', 'L', 'Ukuran standar L', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-xl', 'XL', 'Ukuran standar XL', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-2xl', '2XL', 'Ukuran standar 2XL', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('garment-size-3xl', '3XL', 'Ukuran standar 3XL', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE "BusinessProfile" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "name" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32),
  "email" VARCHAR(320),
  "address" TEXT,
  "logoPath" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessProfile_singleton" CHECK ("id" = 'default'),
  CONSTRAINT "BusinessProfile_version_positive" CHECK ("version" > 0)
);

INSERT INTO "BusinessProfile" ("id", "name", "phone", "email", "address", "createdAt", "updatedAt")
VALUES ('default', 'AS Konveksi', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Opportunity" ADD COLUMN "garmentType" "GarmentType";

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "garmentType" "GarmentType",
  ADD COLUMN "baseColor" VARCHAR(120),
  ADD COLUMN "variationColor" VARCHAR(240),
  ADD COLUMN "decorationMethod" VARCHAR(120),
  ADD COLUMN "orderDate" DATE,
  ADD COLUMN "sampleSize" VARCHAR(40),
  ADD COLUMN "snapshotBusinessName" VARCHAR(160),
  ADD COLUMN "snapshotBusinessPhone" VARCHAR(32),
  ADD COLUMN "snapshotBusinessEmail" VARCHAR(320),
  ADD COLUMN "snapshotBusinessAddress" TEXT,
  ADD COLUMN "snapshotBusinessLogoPath" VARCHAR(500);

UPDATE "PurchaseOrder" SET "baseColor" = "color" WHERE "baseColor" IS NULL;

ALTER TABLE "PurchaseOrderSize"
  ADD COLUMN "sizeId" TEXT,
  ADD COLUMN "sleeveLength" "SleeveLength" NOT NULL DEFAULT 'PANJANG';

UPDATE "PurchaseOrderSize" row
SET "sizeId" = size_master.id
FROM "GarmentSize" size_master
WHERE LOWER(BTRIM(row."size")) = LOWER(BTRIM(size_master."name"));

DROP INDEX IF EXISTS "PurchaseOrderSize_purchaseOrderId_size_key";
CREATE UNIQUE INDEX "PurchaseOrderSize_purchaseOrderId_sleeveLength_size_key" ON "PurchaseOrderSize"("purchaseOrderId", "sleeveLength", "size");
CREATE INDEX "PurchaseOrderSize_sizeId_idx" ON "PurchaseOrderSize"("sizeId");
ALTER TABLE "PurchaseOrderSize" ADD CONSTRAINT "PurchaseOrderSize_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "GarmentSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PurchaseOrderRosterEntry" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "memberId" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "sizeId" TEXT,
  "size" VARCHAR(40) NOT NULL,
  CONSTRAINT "PurchaseOrderRosterEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderRosterEntry_values_valid" CHECK (
    "position" >= 0 AND NULLIF(BTRIM("memberId"), '') IS NOT NULL AND
    NULLIF(BTRIM("name"), '') IS NOT NULL AND NULLIF(BTRIM("size"), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX "PurchaseOrderRosterEntry_purchaseOrderId_position_key" ON "PurchaseOrderRosterEntry"("purchaseOrderId", "position");
CREATE UNIQUE INDEX "PurchaseOrderRosterEntry_purchaseOrderId_memberId_key" ON "PurchaseOrderRosterEntry"("purchaseOrderId", "memberId");
CREATE INDEX "PurchaseOrderRosterEntry_purchaseOrderId_size_idx" ON "PurchaseOrderRosterEntry"("purchaseOrderId", "size");
CREATE INDEX "PurchaseOrderRosterEntry_sizeId_idx" ON "PurchaseOrderRosterEntry"("sizeId");
ALTER TABLE "PurchaseOrderRosterEntry" ADD CONSTRAINT "PurchaseOrderRosterEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderRosterEntry" ADD CONSTRAINT "PurchaseOrderRosterEntry_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "GarmentSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderAttachment"
  ADD COLUMN "kind" "PurchaseOrderAttachmentKind" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "caption" VARCHAR(160);

ALTER TABLE "Invoice"
  ADD COLUMN "snapshotBusinessName" VARCHAR(160),
  ADD COLUMN "snapshotBusinessPhone" VARCHAR(32),
  ADD COLUMN "snapshotBusinessEmail" VARCHAR(320),
  ADD COLUMN "snapshotBusinessAddress" TEXT,
  ADD COLUMN "snapshotBusinessLogoPath" VARCHAR(500),
  ADD COLUMN "totalDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalTax" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "InvoiceItem"
  ADD COLUMN "productName" VARCHAR(120),
  ADD COLUMN "sizeId" TEXT,
  ADD COLUMN "sleeveLength" "SleeveLength",
  ADD COLUMN "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountCapAmount" DECIMAL(18,2),
  ADD COLUMN "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "total" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "InvoiceItem" item
SET
  "productName" = po."productName",
  "grossAmount" = item."subtotal",
  "total" = item."subtotal"
FROM "Invoice" invoice
INNER JOIN "PurchaseOrder" po ON po.id = invoice."purchaseOrderId"
WHERE item."invoiceId" = invoice.id;

UPDATE "InvoiceItem" item
SET "sizeId" = size_master.id
FROM "GarmentSize" size_master
WHERE LOWER(BTRIM(item."size")) = LOWER(BTRIM(size_master."name"));

DROP INDEX IF EXISTS "InvoiceItem_invoiceId_size_key";
CREATE INDEX "InvoiceItem_sizeId_idx" ON "InvoiceItem"("sizeId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "GarmentSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_charges_valid" CHECK (
  "grossAmount" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND
  ("discountCapAmount" IS NULL OR "discountCapAmount" >= 0) AND
  "discountAmount" >= 0 AND "discountAmount" <= "grossAmount" AND
  "taxRate" BETWEEN 0 AND 100 AND "taxAmount" >= 0 AND "total" >= 0 AND
  "grossAmount" = ROUND("quantity" * "unitPrice", 2) AND
  "discountAmount" = CASE
    WHEN "discountCapAmount" IS NULL THEN ROUND("grossAmount" * "discountPercent" / 100, 2)
    ELSE LEAST(ROUND("grossAmount" * "discountPercent" / 100, 2), "discountCapAmount")
  END AND
  "taxAmount" = ROUND(("grossAmount" - "discountAmount") * "taxRate" / 100, 2) AND
  "total" = "grossAmount" - "discountAmount" + "taxAmount" AND
  "subtotal" = "total"
);

ALTER TABLE "SalesOrderItem"
  ADD COLUMN "productName" VARCHAR(120),
  ADD COLUMN "sleeveLength" "SleeveLength",
  ADD COLUMN "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountCapAmount" DECIMAL(18,2),
  ADD COLUMN "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "total" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "SalesOrderItem" SET "grossAmount" = "subtotal", "total" = "subtotal";

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "paymentTermId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidAt" TIMESTAMPTZ(3) NOT NULL,
  "reference" VARCHAR(120),
  "note" VARCHAR(1000),
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "voidedAt" TIMESTAMPTZ(3),
  "voidReason" VARCHAR(1000),
  "voidedById" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentTransaction_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "PaymentTransaction_void_consistent" CHECK (
    ("status" = 'ACTIVE' AND "voidedAt" IS NULL AND "voidReason" IS NULL AND "voidedById" IS NULL)
    OR
    ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND NULLIF(BTRIM(COALESCE("voidReason", '')), '') IS NOT NULL AND "voidedById" IS NOT NULL)
  )
);

CREATE INDEX "PaymentTransaction_paymentId_status_paidAt_idx" ON "PaymentTransaction"("paymentId", "status", "paidAt");
CREATE INDEX "PaymentTransaction_paymentTermId_status_idx" ON "PaymentTransaction"("paymentTermId", "status");
CREATE INDEX "PaymentTransaction_createdById_createdAt_idx" ON "PaymentTransaction"("createdById", "createdAt");
CREATE UNIQUE INDEX "PaymentTransaction_one_active_per_term" ON "PaymentTransaction"("paymentTermId") WHERE "status" = 'ACTIVE' AND "paymentTermId" IS NOT NULL;
CREATE UNIQUE INDEX "PaymentTransaction_one_active_initial" ON "PaymentTransaction"("paymentId") WHERE "status" = 'ACTIVE' AND "paymentTermId" IS NULL;
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_id_paymentId_key" UNIQUE ("id", "paymentId");

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "DealPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentTermId_paymentId_fkey" FOREIGN KEY ("paymentTermId", "paymentId") REFERENCES "PaymentTerm"("id", "paymentId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "PaymentTransaction" ("id", "paymentId", "amount", "paidAt", "status", "createdById", "createdAt")
SELECT 'legacy-transaction-' || payment.id, payment.id, payment."initialAmount", payment."paidAt", 'ACTIVE', payment."createdById", payment."createdAt"
FROM "DealPayment" payment
WHERE payment."initialAmount" > 0
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "GarmentSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderRosterEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "GarmentSize", "BusinessProfile", "PurchaseOrderRosterEntry", "PaymentTransaction" FROM anon, authenticated;

COMMIT;
