-- Kategori produk "Lainnya" dengan alur produksi Non-Jersey.
-- Jenis kategori NON_JERSEY membuat Work Order otomatis memakai tahapan Non-Jersey
-- (Potong/Bordir/Sablon/Printing/Jahit/QC/Packing/Pengiriman/Selesai).
-- Idempoten: aman dijalankan berulang dan tidak menimpa kategori yang sudah ada.

BEGIN;

INSERT INTO "ProductCategory" ("id", "name", "garmentType", "position", "isActive", "createdAt", "updatedAt")
SELECT
  'lainnya-non-jersey',
  'Lainnya',
  'NON_JERSEY'::"GarmentType",
  COALESCE((SELECT MAX("position") FROM "ProductCategory"), 0) + 1,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "ProductCategory" WHERE "name" = 'Lainnya');

COMMIT;
