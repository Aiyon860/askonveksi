-- Sprint 11 (R3): PDF Penjahit custom — deadline per item + desain penjahit per item.
-- Tanpa backfill: deadline lama kosong (tampil "-" di PDF penjahit) sesuai keputusan Owner.

BEGIN;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "penjahitDeadline" DATE;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "penjahitDesignPath" VARCHAR(500);
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "penjahitDesignName" VARCHAR(255);
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "penjahitDesignType" VARCHAR(64);

COMMIT;
