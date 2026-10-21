-- Revisi: Pola pindah dari header PO ke tiap produk (PurchaseOrderItem.pola).
-- Backfill: semua item PO lama mewarisi pola global lamanya supaya PDF & form prefill tidak kosong.

BEGIN;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "pola" VARCHAR(120);

UPDATE "PurchaseOrderItem" AS item
SET "pola" = po."pola"
FROM "PurchaseOrder" AS po
WHERE item."purchaseOrderId" = po."id"
  AND item."pola" IS NULL
  AND po."pola" IS NOT NULL;

COMMIT;
