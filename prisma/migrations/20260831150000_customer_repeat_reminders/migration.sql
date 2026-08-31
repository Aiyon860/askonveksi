CREATE TYPE "CustomerReminderType" AS ENUM ('REPEAT_ORDER', 'REACTIVATION');

CREATE TABLE "CustomerReminder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceSalesOrderId" TEXT NOT NULL,
    "type" "CustomerReminderType" NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "generation" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CustomerReminder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerReminder_generation_positive" CHECK ("generation" > 0)
);

CREATE TABLE "CustomerReminderReceipt" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerReminderReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerReminder_sourceSalesOrderId_type_key"
ON "CustomerReminder"("sourceSalesOrderId", "type");
CREATE INDEX "CustomerReminder_resolvedAt_dueAt_idx"
ON "CustomerReminder"("resolvedAt", "dueAt");
CREATE INDEX "CustomerReminder_customerId_resolvedAt_dueAt_idx"
ON "CustomerReminder"("customerId", "resolvedAt", "dueAt");
CREATE INDEX "CustomerReminder_pending_dueAt_idx"
ON "CustomerReminder"("dueAt", "customerId") WHERE "resolvedAt" IS NULL;

CREATE UNIQUE INDEX "CustomerReminderReceipt_reminderId_actorId_key"
ON "CustomerReminderReceipt"("reminderId", "actorId");
CREATE INDEX "CustomerReminderReceipt_actorId_readAt_idx"
ON "CustomerReminderReceipt"("actorId", "readAt");

ALTER TABLE "CustomerReminder" ADD CONSTRAINT "CustomerReminder_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReminder" ADD CONSTRAINT "CustomerReminder_sourceSalesOrderId_fkey"
FOREIGN KEY ("sourceSalesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReminderReceipt" ADD CONSTRAINT "CustomerReminderReceipt_reminderId_fkey"
FOREIGN KEY ("reminderId") REFERENCES "CustomerReminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReminderReceipt" ADD CONSTRAINT "CustomerReminderReceipt_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH latest_order AS (
  SELECT DISTINCT ON (opportunity."customerId")
    opportunity."customerId",
    sales_order."id" AS "salesOrderId",
    sales_order."acceptedAt"
  FROM "SalesOrder" AS sales_order
  JOIN "Opportunity" AS opportunity ON opportunity."id" = sales_order."opportunityId"
  WHERE sales_order."status" = 'ACTIVE'
  ORDER BY opportunity."customerId", sales_order."acceptedAt" DESC, sales_order."id" DESC
)
INSERT INTO "CustomerReminder" (
  "id", "customerId", "sourceSalesOrderId", "type", "dueAt", "generation", "createdAt", "updatedAt"
)
SELECT
  'rem-' || MD5(latest_order."salesOrderId" || ':' || reminder_type."type"::TEXT),
  latest_order."customerId",
  latest_order."salesOrderId",
  reminder_type."type",
  ((latest_order."acceptedAt" AT TIME ZONE 'Asia/Jakarta') + reminder_type."delay") AT TIME ZONE 'Asia/Jakarta',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM latest_order
CROSS JOIN (
  VALUES
    ('REPEAT_ORDER'::"CustomerReminderType", INTERVAL '3 months'),
    ('REACTIVATION'::"CustomerReminderType", INTERVAL '6 months')
) AS reminder_type("type", "delay");

ALTER TABLE "CustomerReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerReminderReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CustomerReminder", "CustomerReminderReceipt" FROM anon, authenticated;
