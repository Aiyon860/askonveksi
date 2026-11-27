-- Ukuran maksimal citra tanda tangan pada PDF invoice (per brand).
-- Default mengikuti ukuran yang sebelumnya dipakai tetap: 220 x 64 pt.

BEGIN;

ALTER TABLE "InvoiceSetting" ADD COLUMN IF NOT EXISTS "signatureWidth" INTEGER NOT NULL DEFAULT 220;
ALTER TABLE "InvoiceSetting" ADD COLUMN IF NOT EXISTS "signatureHeight" INTEGER NOT NULL DEFAULT 64;

COMMIT;
