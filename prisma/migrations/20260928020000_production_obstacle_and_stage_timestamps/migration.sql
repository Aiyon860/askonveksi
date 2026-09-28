-- Jejak waktu kartu kanban Produksi:
--   * "Kendala" menyimpan kapan isinya terakhir disimpan/diedit, dan tanggalnya ikut
--     hilang ketika isi Kendala dikosongkan.
--   * "Masuk Pada" mencatat kapan Work Order berpindah ke tahap yang ditempatinya sekarang.
ALTER TABLE "ProductionWorkOrder"
  ADD COLUMN "obstacleUpdatedAt" TIMESTAMPTZ(3),
  ADD COLUMN "stageEnteredAt" TIMESTAMPTZ(3);

-- Backfill "Masuk Pada" dari aktivitas perpindahan tahap terakhir tiap Work Order.
UPDATE "ProductionWorkOrder" w
SET "stageEnteredAt" = (
  SELECT max(a."createdAt")
  FROM "ProductionActivity" a
  WHERE a."workOrderId" = w.id
    AND a."type" IN ('CREATED', 'STAGE_MOVED', 'STAGE_SKIPPED', 'STAGE_REVERTED', 'SAMPLE_REJECTED', 'QC_REJECTED', 'REOPENED')
);

-- Backfill tanggal Kendala dari audit penyimpanan Kendala terakhir.
UPDATE "ProductionWorkOrder" w
SET "obstacleUpdatedAt" = (
  SELECT max(e."createdAt")
  FROM "AuditEvent" e
  WHERE e."entityType" = 'ProductionWorkOrder'
    AND e."entityId" = w.id
    AND e."action" = 'PRODUCTION_OBSTACLE_UPDATED'
    AND (e."metadata" ->> 'hasObstacle')::boolean IS TRUE
)
WHERE w."obstacle" IS NOT NULL;

-- Kendala yang tersimpan selalu punya tanggal; mengosongkan Kendala menghapus keduanya.
ALTER TABLE "ProductionWorkOrder"
  ADD CONSTRAINT "ProductionWorkOrder_obstacle_updated_at_required"
  CHECK ("obstacle" IS NULL OR "obstacleUpdatedAt" IS NOT NULL);
