-- Sampel per produk untuk PDF penjahit: qty (default 1) + ukuran.
-- Tanpa backfill: produk lama memakai default qty 1 dan ukuran kosong (NOTE tidak menampilkan sampel).

BEGIN;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "sampleQty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "sampleSize" VARCHAR(40);

COMMIT;
