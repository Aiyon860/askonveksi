ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'PRODUCTION';
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'QC';

CREATE TYPE "ProductionRoute" AS ENUM ('JERSEY', 'NON_JERSEY');
CREATE TYPE "ProductionStage" AS ENUM ('POTONG', 'BORDIR', 'SABLON', 'PRINTING', 'JAHIT', 'QC', 'PACKING', 'PENGIRIMAN', 'TEST_PRINT', 'PERSETUJUAN_SAMPEL', 'LAYOUT_PRODUKSI', 'PRINT', 'CUTTING', 'SELESAI');
CREATE TYPE "ProductionWorkOrderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProductionStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');
CREATE TYPE "ProductionActivityType" AS ENUM ('CREATED', 'STAGE_MOVED', 'SAMPLE_REJECTED', 'QC_REJECTED', 'PIC_ASSIGNED', 'NOTE_ADDED', 'REOPENED', 'CANCELLED');

CREATE TABLE "ProductionWorkOrder" (
  "id" TEXT NOT NULL,
  "workOrderNo" VARCHAR(28) NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "route" "ProductionRoute" NOT NULL,
  "productName" VARCHAR(160) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "deadline" DATE NOT NULL,
  "stageSequence" "ProductionStage"[] NOT NULL,
  "currentStage" "ProductionStage" NOT NULL,
  "status" "ProductionWorkOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "sampleRevision" INTEGER NOT NULL DEFAULT 1,
  "needsRepair" BOOLEAN NOT NULL DEFAULT false,
  "repairReason" TEXT,
  "repairRequestedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ProductionWorkOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionWorkOrder_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "ProductionWorkOrder_stage_sequence_required" CHECK (CARDINALITY("stageSequence") > 0),
  CONSTRAINT "ProductionWorkOrder_repair_reason_required" CHECK (NOT "needsRepair" OR NULLIF(BTRIM("repairReason"), '') IS NOT NULL)
);

CREATE TABLE "ProductionStep" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "stage" "ProductionStage" NOT NULL,
  "position" INTEGER NOT NULL,
  "status" "ProductionStepStatus" NOT NULL DEFAULT 'PENDING',
  "assigneeId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ProductionStep_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionStep_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "ProductionStep_attempt_nonnegative" CHECK ("attemptCount" >= 0)
);

CREATE TABLE "ProductionActivity" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "ProductionActivityType" NOT NULL,
  "fromStage" "ProductionStage",
  "toStage" "ProductionStage",
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionWorkOrder_workOrderNo_key" ON "ProductionWorkOrder"("workOrderNo");
CREATE UNIQUE INDEX "ProductionWorkOrder_salesOrderId_key" ON "ProductionWorkOrder"("salesOrderId");
CREATE INDEX "ProductionWorkOrder_route_status_updatedAt_idx" ON "ProductionWorkOrder"("route", "status", "updatedAt");
CREATE INDEX "ProductionWorkOrder_currentStage_status_updatedAt_idx" ON "ProductionWorkOrder"("currentStage", "status", "updatedAt");
CREATE INDEX "ProductionWorkOrder_deadline_status_idx" ON "ProductionWorkOrder"("deadline", "status");
CREATE UNIQUE INDEX "ProductionStep_workOrderId_stage_key" ON "ProductionStep"("workOrderId", "stage");
CREATE UNIQUE INDEX "ProductionStep_workOrderId_position_key" ON "ProductionStep"("workOrderId", "position");
CREATE INDEX "ProductionStep_assigneeId_status_idx" ON "ProductionStep"("assigneeId", "status");
CREATE INDEX "ProductionActivity_workOrderId_createdAt_id_idx" ON "ProductionActivity"("workOrderId", "createdAt", "id");
CREATE INDEX "ProductionActivity_actorId_createdAt_idx" ON "ProductionActivity"("actorId", "createdAt");

ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionStep" ADD CONSTRAINT "ProductionStep_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionStep" ADD CONSTRAINT "ProductionStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionWorkOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionActivity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ProductionWorkOrder", "ProductionStep", "ProductionActivity" FROM anon, authenticated;
