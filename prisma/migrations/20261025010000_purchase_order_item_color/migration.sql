-- Revisi: warna mengikuti produk, bukan header PO.
-- Satu nomor PO boleh memuat beberapa produk dengan warna berbeda.
-- Tanpa backfill: kolom header PO (color/baseColor/variationColor) tetap dibaca
-- sebagai fallback dokumen lama, jadi PDF PO lama tidak berubah.

BEGIN;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "baseColor" VARCHAR(120);
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "variationColor" VARCHAR(240);

COMMIT;
