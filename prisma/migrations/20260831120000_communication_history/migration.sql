CREATE TYPE "CommunicationActivityKind" AS ENUM ('COMMUNICATION', 'INTERNAL_NOTE', 'SYSTEM');
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'PHONE', 'EMAIL', 'MEETING', 'OTHER');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationSystemEvent" AS ENUM ('STAGE_CHANGED', 'QUOTATION_ISSUED', 'DEAL_ORDER_CREATED', 'SALES_ORDER_CANCELLED');

ALTER TABLE "CRMNote" RENAME TO "CommunicationActivity";
ALTER TABLE "CommunicationActivity" RENAME CONSTRAINT "CRMNote_pkey" TO "CommunicationActivity_pkey";
ALTER TABLE "CommunicationActivity" RENAME CONSTRAINT "CRMNote_content_required" TO "CommunicationActivity_content_required";
ALTER TABLE "CommunicationActivity" RENAME CONSTRAINT "CRMNote_opportunityId_fkey" TO "CommunicationActivity_opportunityId_fkey";
ALTER TABLE "CommunicationActivity" RENAME CONSTRAINT "CRMNote_authorId_fkey" TO "CommunicationActivity_authorId_fkey";

ALTER INDEX "CRMNote_opportunityId_createdAt_idx" RENAME TO "CommunicationActivity_opportunityId_createdAt_idx";
ALTER INDEX "CRMNote_authorId_createdAt_idx" RENAME TO "CommunicationActivity_authorId_createdAt_idx";

ALTER TABLE "CommunicationActivity"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "kind" "CommunicationActivityKind" NOT NULL DEFAULT 'INTERNAL_NOTE',
  ADD COLUMN "channel" "CommunicationChannel",
  ADD COLUMN "direction" "CommunicationDirection",
  ADD COLUMN "systemEvent" "CommunicationSystemEvent",
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "occurredAt" TIMESTAMPTZ(3),
  ADD COLUMN "sourceAuditEventId" TEXT;

UPDATE "CommunicationActivity" AS activity
SET
  "customerId" = opportunity."customerId",
  "occurredAt" = activity."createdAt"
FROM "Opportunity" AS opportunity
WHERE opportunity."id" = activity."opportunityId";

ALTER TABLE "CommunicationActivity"
  ALTER COLUMN "customerId" SET NOT NULL,
  ALTER COLUMN "occurredAt" SET NOT NULL,
  ALTER COLUMN "opportunityId" DROP NOT NULL,
  ALTER COLUMN "kind" DROP DEFAULT;

ALTER TABLE "CommunicationActivity"
  ADD CONSTRAINT "CommunicationActivity_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunicationActivity_sourceAuditEventId_fkey"
    FOREIGN KEY ("sourceAuditEventId") REFERENCES "AuditEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunicationActivity_shape_valid" CHECK (
    (
      "kind" = 'COMMUNICATION' AND
      "channel" IS NOT NULL AND
      "direction" IS NOT NULL AND
      "systemEvent" IS NULL
    ) OR (
      "kind" = 'INTERNAL_NOTE' AND
      "channel" IS NULL AND
      "direction" IS NULL AND
      "systemEvent" IS NULL
    ) OR (
      "kind" = 'SYSTEM' AND
      "channel" IS NULL AND
      "direction" IS NULL AND
      "systemEvent" IS NOT NULL
    )
  );

DROP INDEX "CommunicationActivity_opportunityId_createdAt_idx";
DROP INDEX "CommunicationActivity_authorId_createdAt_idx";
CREATE UNIQUE INDEX "CommunicationActivity_sourceAuditEventId_key" ON "CommunicationActivity"("sourceAuditEventId");
CREATE INDEX "CommunicationActivity_customerId_occurredAt_id_idx" ON "CommunicationActivity"("customerId", "occurredAt", "id");
CREATE INDEX "CommunicationActivity_opportunityId_occurredAt_id_idx" ON "CommunicationActivity"("opportunityId", "occurredAt", "id");
CREATE INDEX "CommunicationActivity_authorId_occurredAt_idx" ON "CommunicationActivity"("authorId", "occurredAt");

-- Backfill ordinary pipeline movements. Deal and cancellation reversals are
-- represented by their Sales Order milestones to avoid duplicate entries.
INSERT INTO "CommunicationActivity" (
  "id", "customerId", "opportunityId", "authorId", "kind", "systemEvent",
  "content", "metadata", "occurredAt", "sourceAuditEventId", "createdAt"
)
SELECT
  'history-' || audit."id",
  opportunity."customerId",
  opportunity."id",
  audit."actorId",
  'SYSTEM'::"CommunicationActivityKind",
  'STAGE_CHANGED'::"CommunicationSystemEvent",
  'Status peluang berubah dari ' ||
    replace(initcap(lower(COALESCE(audit."metadata"->>'from', 'status sebelumnya'))), '_', ' ') ||
    ' menjadi ' ||
    replace(initcap(lower(COALESCE(audit."metadata"->>'to', 'status baru'))), '_', ' ') || '.',
  audit."metadata",
  audit."createdAt",
  audit."id",
  audit."createdAt"
FROM "AuditEvent" AS audit
JOIN "Opportunity" AS opportunity ON opportunity."id" = audit."entityId"
WHERE audit."entityType" = 'Opportunity'
  AND audit."action" = 'OPPORTUNITY_STAGE_CHANGED'
  AND COALESCE(audit."metadata"->>'to', '') <> 'DEAL'
  AND NOT (
    audit."metadata"->>'from' = 'DEAL' AND
    audit."metadata"->>'to' = 'PENAWARAN'
  );

INSERT INTO "CommunicationActivity" (
  "id", "customerId", "opportunityId", "authorId", "kind", "systemEvent",
  "content", "metadata", "occurredAt", "sourceAuditEventId", "createdAt"
)
SELECT
  'history-' || audit."id",
  opportunity."customerId",
  opportunity."id",
  audit."actorId",
  'SYSTEM'::"CommunicationActivityKind",
  'QUOTATION_ISSUED'::"CommunicationSystemEvent",
  'Quotation ' || quotation."quotationNo" || ' diterbitkan.',
  jsonb_build_object('quotationId', quotation."id", 'quotationNo', quotation."quotationNo", 'revision', quotation."revision"),
  audit."createdAt",
  audit."id",
  audit."createdAt"
FROM "AuditEvent" AS audit
JOIN "Quotation" AS quotation ON quotation."id" = audit."entityId"
JOIN "Opportunity" AS opportunity ON opportunity."id" = quotation."opportunityId"
WHERE audit."entityType" = 'Quotation'
  AND audit."action" = 'QUOTATION_ISSUED';

INSERT INTO "CommunicationActivity" (
  "id", "customerId", "opportunityId", "authorId", "kind", "systemEvent",
  "content", "metadata", "occurredAt", "sourceAuditEventId", "createdAt"
)
SELECT
  'history-' || audit."id",
  opportunity."customerId",
  opportunity."id",
  audit."actorId",
  'SYSTEM'::"CommunicationActivityKind",
  'DEAL_ORDER_CREATED'::"CommunicationSystemEvent",
  'Customer deal dan Sales Order ' || sales_order."salesOrderNo" || ' terbentuk.',
  jsonb_build_object('salesOrderId', sales_order."id", 'salesOrderNo', sales_order."salesOrderNo", 'quotationId', sales_order."quotationId"),
  audit."createdAt",
  audit."id",
  audit."createdAt"
FROM "AuditEvent" AS audit
JOIN "SalesOrder" AS sales_order ON sales_order."id" = audit."entityId"
JOIN "Opportunity" AS opportunity ON opportunity."id" = sales_order."opportunityId"
WHERE audit."entityType" = 'SalesOrder'
  AND audit."action" = 'SALES_ORDER_CREATED';

INSERT INTO "CommunicationActivity" (
  "id", "customerId", "opportunityId", "authorId", "kind", "systemEvent",
  "content", "metadata", "occurredAt", "sourceAuditEventId", "createdAt"
)
SELECT
  'history-' || audit."id",
  opportunity."customerId",
  opportunity."id",
  audit."actorId",
  'SYSTEM'::"CommunicationActivityKind",
  'SALES_ORDER_CANCELLED'::"CommunicationSystemEvent",
  'Sales Order ' || sales_order."salesOrderNo" || ' dibatalkan dan peluang dikembalikan ke Penawaran.',
  jsonb_build_object('salesOrderId', sales_order."id", 'salesOrderNo', sales_order."salesOrderNo", 'cancelReason', sales_order."cancelReason"),
  audit."createdAt",
  audit."id",
  audit."createdAt"
FROM "AuditEvent" AS audit
JOIN "SalesOrder" AS sales_order ON sales_order."id" = audit."entityId"
JOIN "Opportunity" AS opportunity ON opportunity."id" = sales_order."opportunityId"
WHERE audit."entityType" = 'SalesOrder'
  AND audit."action" = 'SALES_ORDER_CANCELLED';

ALTER TABLE "CommunicationActivity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CommunicationActivity" FROM anon, authenticated;
