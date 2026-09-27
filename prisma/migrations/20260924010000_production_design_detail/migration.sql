ALTER TABLE "ProductionWorkOrder"
  ADD COLUMN "designCompletedAt" TIMESTAMPTZ(3);

CREATE INDEX "ProductionWorkOrder_designCompletedAt_route_idx"
  ON "ProductionWorkOrder" ("designCompletedAt", "route", "updatedAt");
