ALTER TYPE "WhatsAppJobType" ADD VALUE 'CAMPAIGN';

CREATE TYPE "WhatsAppCampaignStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "BusinessProfile"
  ADD COLUMN "repeatOrderIntervals" INTEGER[] NOT NULL DEFAULT ARRAY[6, 5]::INTEGER[];

ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_repeat_order_intervals_valid"
  CHECK (
    cardinality("repeatOrderIntervals") BETWEEN 1 AND 24
    AND 1 <= ALL("repeatOrderIntervals")
    AND 120 >= ALL("repeatOrderIntervals")
  );

ALTER TABLE "CustomerReminder"
  ADD COLUMN "nextOccurrence" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CustomerReminder" ADD CONSTRAINT "CustomerReminder_next_occurrence_positive"
  CHECK ("nextOccurrence" > 0);

UPDATE "WhatsAppTemplate"
SET
  "name" = CASE WHEN "name" = 'Pengingat order enam bulan' THEN 'Pengingat repeat order' ELSE "name" END,
  "body" = 'Halo {{customer_name}}, sudah waktunya meninjau kebutuhan order berikutnya di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.',
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'system-template-order-reminder'
  AND "body" = 'Halo {{customer_name}}, sudah enam bulan sejak order terakhir di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PurchaseOrderRosterEntry" LIMIT 1) THEN
    RAISE EXCEPTION 'PurchaseOrderRosterEntry must be empty before adding required sleeveLength';
  END IF;
END $$;

ALTER TABLE "PurchaseOrderRosterEntry"
  ADD COLUMN "sleeveLength" "SleeveLength" NOT NULL;

CREATE TABLE "WhatsAppCampaign" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "body" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "WhatsAppCampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "recipientCursor" TEXT,
  "startedAt" TIMESTAMPTZ(3),
  "snapshotCompletedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppCampaign_name_required" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "WhatsAppCampaign_body_required" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "WhatsAppCampaign_version_positive" CHECK ("version" > 0)
);

ALTER TABLE "WhatsAppAutomationJob" ADD COLUMN "campaignId" TEXT;

CREATE INDEX "WhatsAppCampaign_status_scheduledAt_idx" ON "WhatsAppCampaign"("status", "scheduledAt");
CREATE INDEX "WhatsAppCampaign_createdById_createdAt_idx" ON "WhatsAppCampaign"("createdById", "createdAt");
CREATE INDEX "WhatsAppCampaign_updatedById_updatedAt_idx" ON "WhatsAppCampaign"("updatedById", "updatedAt");
CREATE INDEX "WhatsAppAutomationJob_campaignId_status_scheduledAt_idx" ON "WhatsAppAutomationJob"("campaignId", "status", "scheduledAt");
CREATE UNIQUE INDEX "WhatsAppAutomationJob_campaignId_customerId_key" ON "WhatsAppAutomationJob"("campaignId", "customerId");

ALTER TABLE "WhatsAppCampaign" ADD CONSTRAINT "WhatsAppCampaign_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppCampaign" ADD CONSTRAINT "WhatsAppCampaign_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WhatsAppCampaign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WhatsAppCampaign" FROM anon, authenticated;
