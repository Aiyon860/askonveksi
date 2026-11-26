-- Bahan mengikuti produk: satu PO boleh memuat beberapa bahan.
-- Backfill dari bahan header PO supaya dokumen lama tidak kehilangan keterangan bahan.

BEGIN;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "material" VARCHAR(120);

UPDATE "PurchaseOrderItem" AS item
SET "material" = po."material"
FROM "PurchaseOrder" AS po
WHERE item."purchaseOrderId" = po."id"
  AND item."material" IS NULL;

COMMIT;
