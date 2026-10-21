-- Revisi Project: Status HPP berupa switch manual (hppComplete).
-- Backfill: order yang semua 7 kolom HPP non-null dianggap Lengkap (setara logika lama).
BEGIN;

ALTER TABLE "SalesOrderCost" ADD COLUMN IF NOT EXISTS "hppComplete" BOOLEAN NOT NULL DEFAULT false;

UPDATE "SalesOrderCost"
SET "hppComplete" = true
WHERE "kain" IS NOT NULL
  AND "zipper" IS NOT NULL
  AND "jahit" IS NOT NULL
  AND "pres" IS NOT NULL
  AND "dtfPlastisol" IS NOT NULL
  AND "bordir" IS NOT NULL
  AND "lainnya" IS NOT NULL;

COMMIT;
