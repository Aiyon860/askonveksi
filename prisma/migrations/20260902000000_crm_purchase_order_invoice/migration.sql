-- This migration intentionally resets CRM business data. User accounts and
-- master data remain intact.

-- Supabase protects storage tables from direct deletion. The retired bucket is
-- emptied and deleted through the Storage API by `npm run crm:reset-storage`.

BEGIN;

DELETE FROM "CustomerReminderReceipt";
DELETE FROM "CustomerReminder";
DELETE FROM "SalesOrderItem";
DELETE FROM "SalesOrder";
DELETE FROM "CommunicationActivity";
DELETE FROM "Opportunity";
DELETE FROM "Customer";
DELETE FROM "PublicRateLimitBucket";
DELETE FROM "AuditEvent"
WHERE "entityType" IN ('Customer', 'Opportunity', 'CommunicationActivity', 'Quotation', 'SalesOrder');
DELETE FROM "SequenceCounter"
WHERE "key" = 'customer'
   OR "key" = 'opportunity'
   OR "key" LIKE 'quotation:%'
   OR "key" LIKE 'invoice:%'
   OR "key" LIKE 'purchase-order:%'
   OR "key" LIKE 'sales-order:%';

ALTER TABLE "SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_quotationId_fkey";
DROP INDEX IF EXISTS "SalesOrder_quotationId_key";
DROP TABLE IF EXISTS "QuotationItem";
DROP TABLE IF EXISTS "Quotation";

ALTER TABLE "Opportunity" ALTER COLUMN "stage" DROP DEFAULT;
-- PostgreSQL keeps the enum type identity inside CHECK expressions. Drop the
-- stage-dependent constraint before replacing the enum, then recreate it
-- against the new type below.
ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_lost_reason_required";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityStage_old') THEN
    ALTER TYPE "OpportunityStage" RENAME TO "OpportunityStage_old";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityStage') THEN
    CREATE TYPE "OpportunityStage" AS ENUM ('LEAD_BARU', 'FOLLOW_UP', 'NEGOSIASI', 'DEAL', 'LOST');
  END IF;
END
$$;
ALTER TABLE "Opportunity"
  ALTER COLUMN "stage" TYPE "OpportunityStage"
  USING ("stage"::text::"OpportunityStage");
ALTER TABLE "Opportunity" ALTER COLUMN "stage" SET DEFAULT 'LEAD_BARU';
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_lost_reason_required" CHECK (
    "stage" <> 'LOST' OR NULLIF(BTRIM(COALESCE("cancelReason", '')), '') IS NOT NULL
  );
DROP TYPE "OpportunityStage_old";

ALTER TYPE "CommunicationSystemEvent" RENAME TO "CommunicationSystemEvent_old";
CREATE TYPE "CommunicationSystemEvent" AS ENUM (
  'STAGE_CHANGED',
  'PURCHASE_ORDER_AGREED',
  'INVOICE_ISSUED',
  'DEAL_ORDER_CREATED',
  'SALES_ORDER_CANCELLED'
);
ALTER TABLE "CommunicationActivity"
  ALTER COLUMN "systemEvent" TYPE "CommunicationSystemEvent"
  USING ("systemEvent"::text::"CommunicationSystemEvent");
DROP TYPE "CommunicationSystemEvent_old";

DROP TYPE "QuotationStatus";
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'AGREED', 'SUPERSEDED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SUPERSEDED');
CREATE TYPE "PaymentKind" AS ENUM ('LUNAS', 'DP');
CREATE TYPE "PaymentValueType" AS ENUM ('NOMINAL', 'PERCENTAGE');

ALTER TABLE "SalesOrder"
  DROP COLUMN "quotationId",
  DROP COLUMN "quotationNo",
  ADD COLUMN "purchaseOrderId" TEXT NOT NULL,
  ADD COLUMN "invoiceId" TEXT NOT NULL,
  ADD COLUMN "purchaseOrderNo" VARCHAR(28) NOT NULL,
  ADD COLUMN "invoiceNo" VARCHAR(28) NOT NULL;

ALTER TABLE "SalesOrderItem"
  ADD COLUMN "size" VARCHAR(40) NOT NULL;

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "purchaseOrderNo" VARCHAR(28) NOT NULL,
  "customerReference" VARCHAR(120),
  "opportunityId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "productName" VARCHAR(120) NOT NULL,
  "material" VARCHAR(120) NOT NULL,
  "color" VARCHAR(120),
  "designNotes" TEXT,
  "notes" TEXT,
  "deadline" DATE,
  "agreedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "PurchaseOrder_agreed_at_required" CHECK ("status" <> 'AGREED' OR "agreedAt" IS NOT NULL)
);

CREATE TABLE "PurchaseOrderSize" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "size" VARCHAR(40) NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "PurchaseOrderSize_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderSize_values_valid" CHECK ("position" >= 0 AND "quantity" > 0 AND NULLIF(BTRIM("size"), '') IS NOT NULL)
);

CREATE TABLE "PurchaseOrderAttachment" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderAttachment_size_valid" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880)
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNo" VARCHAR(28) NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "snapshotCustomerName" VARCHAR(160) NOT NULL,
  "snapshotCompanyName" VARCHAR(160),
  "snapshotWhatsapp" VARCHAR(32),
  "snapshotEmail" VARCHAR(320),
  "snapshotInstagram" VARCHAR(80),
  "snapshotAddress" TEXT,
  "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
  "discountValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "total" DECIMAL(18,2) NOT NULL,
  "issuedAt" TIMESTAMPTZ(3),
  "dueAt" DATE,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "Invoice_totals_nonnegative" CHECK ("subtotal" >= 0 AND "total" >= 0 AND "discountValue" >= 0),
  CONSTRAINT "Invoice_percentage_valid" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100),
  CONSTRAINT "Invoice_discount_none_zero" CHECK ("discountType" <> 'NONE' OR "discountValue" = 0),
  CONSTRAINT "Invoice_issued_at_required" CHECK ("status" = 'DRAFT' OR "issuedAt" IS NOT NULL)
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "size" VARCHAR(40) NOT NULL,
  "description" VARCHAR(240) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceItem_values_valid" CHECK (
    "position" >= 0 AND "quantity" > 0 AND "unitPrice" >= 0 AND "subtotal" = "quantity" * "unitPrice"
  )
);

CREATE TABLE "DealPayment" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "kind" "PaymentKind" NOT NULL,
  "paidAt" TIMESTAMPTZ(3) NOT NULL,
  "initialValueType" "PaymentValueType" NOT NULL,
  "initialValue" DECIMAL(18,2) NOT NULL,
  "initialAmount" DECIMAL(18,2) NOT NULL,
  "outstandingAmount" DECIMAL(18,2) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealPayment_values_valid" CHECK (
    "initialValue" > 0 AND "initialAmount" > 0 AND "outstandingAmount" >= 0 AND
    ("initialValueType" <> 'PERCENTAGE' OR "initialValue" <= 100)
  )
);

CREATE TABLE "PaymentTerm" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "valueType" "PaymentValueType" NOT NULL,
  "value" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "dueAt" DATE NOT NULL,
  CONSTRAINT "PaymentTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentTerm_values_valid" CHECK (
    "position" >= 0 AND "value" > 0 AND "amount" > 0 AND
    ("valueType" <> 'PERCENTAGE' OR "value" <= 100)
  )
);

CREATE UNIQUE INDEX "PurchaseOrder_purchaseOrderNo_key" ON "PurchaseOrder"("purchaseOrderNo");
CREATE UNIQUE INDEX "PurchaseOrder_opportunityId_revision_key" ON "PurchaseOrder"("opportunityId", "revision");
CREATE UNIQUE INDEX "PurchaseOrder_one_draft_per_opportunity" ON "PurchaseOrder"("opportunityId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "PurchaseOrder_one_agreed_per_opportunity" ON "PurchaseOrder"("opportunityId") WHERE "status" = 'AGREED';
CREATE INDEX "PurchaseOrder_opportunityId_status_idx" ON "PurchaseOrder"("opportunityId", "status");
CREATE INDEX "PurchaseOrder_createdById_createdAt_idx" ON "PurchaseOrder"("createdById", "createdAt");
CREATE UNIQUE INDEX "PurchaseOrderSize_purchaseOrderId_position_key" ON "PurchaseOrderSize"("purchaseOrderId", "position");
CREATE UNIQUE INDEX "PurchaseOrderSize_purchaseOrderId_size_key" ON "PurchaseOrderSize"("purchaseOrderId", "size");
CREATE INDEX "PurchaseOrderSize_purchaseOrderId_idx" ON "PurchaseOrderSize"("purchaseOrderId");
CREATE INDEX "PurchaseOrderAttachment_purchaseOrderId_createdAt_idx" ON "PurchaseOrderAttachment"("purchaseOrderId", "createdAt");
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
CREATE UNIQUE INDEX "Invoice_opportunityId_revision_key" ON "Invoice"("opportunityId", "revision");
CREATE UNIQUE INDEX "Invoice_one_draft_per_opportunity" ON "Invoice"("opportunityId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "Invoice_one_issued_per_opportunity" ON "Invoice"("opportunityId") WHERE "status" = 'ISSUED';
CREATE INDEX "Invoice_opportunityId_status_idx" ON "Invoice"("opportunityId", "status");
CREATE INDEX "Invoice_purchaseOrderId_status_idx" ON "Invoice"("purchaseOrderId", "status");
CREATE INDEX "Invoice_createdById_createdAt_idx" ON "Invoice"("createdById", "createdAt");
CREATE UNIQUE INDEX "InvoiceItem_invoiceId_position_key" ON "InvoiceItem"("invoiceId", "position");
CREATE UNIQUE INDEX "InvoiceItem_invoiceId_size_key" ON "InvoiceItem"("invoiceId", "size");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE UNIQUE INDEX "SalesOrder_purchaseOrderId_key" ON "SalesOrder"("purchaseOrderId");
CREATE UNIQUE INDEX "SalesOrder_invoiceId_key" ON "SalesOrder"("invoiceId");
CREATE UNIQUE INDEX "DealPayment_salesOrderId_key" ON "DealPayment"("salesOrderId");
CREATE INDEX "DealPayment_createdById_createdAt_idx" ON "DealPayment"("createdById", "createdAt");
CREATE UNIQUE INDEX "PaymentTerm_paymentId_position_key" ON "PaymentTerm"("paymentId", "position");
CREATE INDEX "PaymentTerm_paymentId_dueAt_idx" ON "PaymentTerm"("paymentId", "dueAt");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderSize" ADD CONSTRAINT "PurchaseOrderSize_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderAttachment" ADD CONSTRAINT "PurchaseOrderAttachment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "DealPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTerm" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "PurchaseOrder", "PurchaseOrderSize", "PurchaseOrderAttachment", "Invoice", "InvoiceItem", "DealPayment", "PaymentTerm" FROM anon, authenticated;

COMMIT;
