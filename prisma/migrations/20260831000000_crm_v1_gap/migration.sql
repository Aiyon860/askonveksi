ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_follow_up_date_required";
ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_cancel_reason_required";

ALTER TYPE "OpportunityStage" RENAME VALUE 'LEAD' TO 'LEAD_BARU';
ALTER TYPE "OpportunityStage" RENAME VALUE 'BATAL' TO 'LOST';
ALTER TYPE "OpportunityStage" ADD VALUE 'DIHUBUNGI' AFTER 'LEAD_BARU';
ALTER TYPE "OpportunityStage" ADD VALUE 'KEBUTUHAN_TERGALI' AFTER 'DIHUBUNGI';
ALTER TYPE "OpportunityStage" ADD VALUE 'NEGOSIASI' AFTER 'FOLLOW_UP';

CREATE TYPE "DesignStatus" AS ENUM ('SUDAH_ADA', 'BELUM_ADA', 'PERLU_DIBANTU');

ALTER TABLE "Opportunity" RENAME COLUMN "followUpAt" TO "nextActionAt";
ALTER TABLE "Opportunity"
  ADD COLUMN "leadSourceId" TEXT,
  ADD COLUMN "salesPicId" TEXT,
  ADD COLUMN "productName" VARCHAR(120),
  ADD COLUMN "needPurpose" VARCHAR(500),
  ADD COLUMN "designStatus" "DesignStatus",
  ADD COLUMN "specification" TEXT,
  ADD COLUMN "customerBudget" DECIMAL(18,2),
  ADD COLUMN "leadScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastContactedAt" TIMESTAMPTZ(3),
  ADD COLUMN "nextAction" VARCHAR(500),
  ADD COLUMN "publicSubmissionKey" UUID;

UPDATE "Opportunity" AS opportunity
SET
  "leadSourceId" = customer."leadSourceId",
  "salesPicId" = customer."salesPicId",
  "nextAction" = CASE
    WHEN opportunity."nextActionAt" IS NOT NULL THEN 'Follow-up customer'
    ELSE NULL
  END
FROM "Customer" AS customer
WHERE customer."id" = opportunity."customerId";

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_lead_score_range" CHECK ("leadScore" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Opportunity_customer_budget_nonnegative" CHECK ("customerBudget" IS NULL OR "customerBudget" >= 0),
  ADD CONSTRAINT "Opportunity_next_action_pair" CHECK (("nextAction" IS NULL) = ("nextActionAt" IS NULL)),
  ADD CONSTRAINT "Opportunity_lost_reason_required" CHECK (
    "stage" <> 'LOST' OR NULLIF(BTRIM(COALESCE("cancelReason", '')), '') IS NOT NULL
  );

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Opportunity_salesPicId_fkey" FOREIGN KEY ("salesPicId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Opportunity_stage_followUpAt_idx";
CREATE INDEX "Opportunity_salesPicId_stage_idx" ON "Opportunity"("salesPicId", "stage");
CREATE INDEX "Opportunity_salesPicId_nextActionAt_idx" ON "Opportunity"("salesPicId", "nextActionAt");
CREATE INDEX "Opportunity_leadSourceId_createdAt_idx" ON "Opportunity"("leadSourceId", "createdAt");
CREATE INDEX "Opportunity_leadScore_stage_idx" ON "Opportunity"("leadScore", "stage");
CREATE UNIQUE INDEX "Opportunity_publicSubmissionKey_key" ON "Opportunity"("publicSubmissionKey");

CREATE TABLE "PublicRateLimitBucket" (
  "key" VARCHAR(64) NOT NULL,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "PublicRateLimitBucket_count_positive" CHECK ("count" > 0)
);

CREATE INDEX "PublicRateLimitBucket_updatedAt_idx" ON "PublicRateLimitBucket"("updatedAt");

INSERT INTO "LeadSource" ("id", "name", "description", "position", "isActive", "createdAt", "updatedAt")
VALUES ('lead-source-landing-page', 'Landing Page', 'Lead dari formulir website Askonveksi', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "PublicRateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PublicRateLimitBucket" FROM anon, authenticated;
