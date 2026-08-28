CREATE TYPE "AppRole" AS ENUM ('OWNER', 'ADMIN', 'SALES');
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'FOLLOW_UP', 'PENAWARAN', 'DEAL', 'BATAL');
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'NOMINAL', 'PERCENTAGE');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'SUPERSEDED');
CREATE TYPE "SalesOrderStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "authUserId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "AppRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerNo" VARCHAR(24) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "companyName" VARCHAR(160),
    "whatsapp" VARCHAR(32),
    "email" VARCHAR(320),
    "instagram" VARCHAR(80),
    "address" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Customer_contact_required" CHECK (
      NULLIF(BTRIM(COALESCE("whatsapp", '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE("email", '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE("instagram", '')), '') IS NOT NULL
    )
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "opportunityNo" VARCHAR(24) NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'LEAD',
    "estimatedQuantity" INTEGER,
    "estimatedValue" DECIMAL(18,2),
    "deadline" DATE,
    "followUpAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Opportunity_estimated_quantity_positive" CHECK ("estimatedQuantity" IS NULL OR "estimatedQuantity" > 0),
    CONSTRAINT "Opportunity_estimated_value_nonnegative" CHECK ("estimatedValue" IS NULL OR "estimatedValue" >= 0),
    CONSTRAINT "Opportunity_follow_up_date_required" CHECK ("stage" <> 'FOLLOW_UP' OR "followUpAt" IS NOT NULL),
    CONSTRAINT "Opportunity_cancel_reason_required" CHECK ("stage" <> 'BATAL' OR NULLIF(BTRIM(COALESCE("cancelReason", '')), '') IS NOT NULL)
);

CREATE TABLE "CRMNote" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CRMNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CRMNote_content_required" CHECK (NULLIF(BTRIM("content"), '') IS NOT NULL)
);

CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNo" VARCHAR(28) NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
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
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptanceReference" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Quotation_revision_positive" CHECK ("revision" > 0),
    CONSTRAINT "Quotation_totals_nonnegative" CHECK ("subtotal" >= 0 AND "total" >= 0 AND "discountValue" >= 0),
    CONSTRAINT "Quotation_percentage_valid" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100),
    CONSTRAINT "Quotation_discount_none_zero" CHECK ("discountType" <> 'NONE' OR "discountValue" = 0),
    CONSTRAINT "Quotation_issued_at_required" CHECK ("status" = 'DRAFT' OR "issuedAt" IS NOT NULL),
    CONSTRAINT "Quotation_acceptance_required" CHECK (
      "status" <> 'ACCEPTED' OR
      ("acceptedAt" IS NOT NULL AND NULLIF(BTRIM(COALESCE("acceptanceReference", '')), '') IS NOT NULL)
    )
);

CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuotationItem_values_valid" CHECK (
      "position" >= 0 AND "quantity" > 0 AND "unitPrice" >= 0 AND "subtotal" = "quantity" * "unitPrice"
    )
);

CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "salesOrderNo" VARCHAR(28) NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationNo" VARCHAR(28) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "snapshotCustomerName" VARCHAR(160) NOT NULL,
    "snapshotCompanyName" VARCHAR(160),
    "snapshotWhatsapp" VARCHAR(32),
    "snapshotEmail" VARCHAR(320),
    "snapshotInstagram" VARCHAR(80),
    "snapshotAddress" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(18,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalesOrder_totals_nonnegative" CHECK ("subtotal" >= 0 AND "total" >= 0 AND "discountValue" >= 0),
    CONSTRAINT "SalesOrder_cancellation_required" CHECK (
      "status" <> 'CANCELLED' OR
      ("cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND NULLIF(BTRIM(COALESCE("cancelReason", '')), '') IS NOT NULL)
    ),
    CONSTRAINT "SalesOrder_active_not_cancelled" CHECK (
      "status" <> 'ACTIVE' OR ("cancelledAt" IS NULL AND "cancelReason" IS NULL AND "cancelledById" IS NULL)
    )
);

CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalesOrderItem_values_valid" CHECK (
      "position" >= 0 AND "quantity" > 0 AND "unitPrice" >= 0 AND "subtotal" = "quantity" * "unitPrice"
    )
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" VARCHAR(64) NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "changedFields" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceCounter" (
    "key" VARCHAR(64) NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "SequenceCounter_value_positive" CHECK ("value" > 0)
);

CREATE UNIQUE INDEX "AppUser_authUserId_key" ON "AppUser"("authUserId");
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX "AppUser_role_isActive_idx" ON "AppUser"("role", "isActive");
CREATE UNIQUE INDEX "Customer_customerNo_key" ON "Customer"("customerNo");
CREATE INDEX "Customer_archivedAt_updatedAt_idx" ON "Customer"("archivedAt", "updatedAt");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");
CREATE UNIQUE INDEX "Opportunity_opportunityNo_key" ON "Opportunity"("opportunityNo");
CREATE INDEX "Opportunity_customerId_updatedAt_idx" ON "Opportunity"("customerId", "updatedAt");
CREATE INDEX "Opportunity_stage_updatedAt_idx" ON "Opportunity"("stage", "updatedAt");
CREATE INDEX "Opportunity_stage_followUpAt_idx" ON "Opportunity"("stage", "followUpAt");
CREATE INDEX "CRMNote_opportunityId_createdAt_idx" ON "CRMNote"("opportunityId", "createdAt");
CREATE INDEX "CRMNote_authorId_createdAt_idx" ON "CRMNote"("authorId", "createdAt");
CREATE UNIQUE INDEX "Quotation_quotationNo_key" ON "Quotation"("quotationNo");
CREATE INDEX "Quotation_opportunityId_status_idx" ON "Quotation"("opportunityId", "status");
CREATE INDEX "Quotation_createdById_createdAt_idx" ON "Quotation"("createdById", "createdAt");
CREATE UNIQUE INDEX "Quotation_opportunityId_revision_key" ON "Quotation"("opportunityId", "revision");
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE UNIQUE INDEX "QuotationItem_quotationId_position_key" ON "QuotationItem"("quotationId", "position");
CREATE UNIQUE INDEX "SalesOrder_salesOrderNo_key" ON "SalesOrder"("salesOrderNo");
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");
CREATE UNIQUE INDEX "SalesOrder_one_active_per_opportunity" ON "SalesOrder"("opportunityId") WHERE "status" = 'ACTIVE';
CREATE INDEX "SalesOrder_opportunityId_status_idx" ON "SalesOrder"("opportunityId", "status");
CREATE INDEX "SalesOrder_createdById_createdAt_idx" ON "SalesOrder"("createdById", "createdAt");
CREATE INDEX "SalesOrder_status_createdAt_idx" ON "SalesOrder"("status", "createdAt");
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");
CREATE UNIQUE INDEX "SalesOrderItem_salesOrderId_position_key" ON "SalesOrderItem"("salesOrderId", "position");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CRMNote" ADD CONSTRAINT "CRMNote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CRMNote" ADD CONSTRAINT "CRMNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma uses a trusted server-side database role. Browser roles must not access
-- application tables through Supabase's Data API.
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRMNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuotationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SequenceCounter" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "AppUser", "Customer", "Opportunity", "CRMNote", "Quotation", "QuotationItem", "SalesOrder", "SalesOrderItem", "AuditEvent", "SequenceCounter" FROM anon, authenticated;
