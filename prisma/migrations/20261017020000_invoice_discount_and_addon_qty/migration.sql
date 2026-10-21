-- Revisi Sprint 8 (R4 + R6): Add On punya Qty sendiri; diskon nominal/persen dua level.
-- R4: kolom qty per add-on (default 1). Data lama di-backfill = qty baris supaya total
--     invoice lama tidak berubah (perhitungan lama unitAmount × qty baris).
-- R6: kolom tipe diskon per baris; kolom nominal untuk diskon level total invoice.
--     Invoice/SalesOrder lama: kolom discountValue berisi persen DEFAULT per baris yang sudah
--     ikut terhitung di tiap item — kalau dipakai ulang sebagai diskon order, total dobel.
--     Maka tipe & nilai lama di-reset ke NONE.

ALTER TABLE "InvoiceItemAddon" ADD COLUMN IF NOT EXISTS "qty" INTEGER NOT NULL DEFAULT 1;

UPDATE "InvoiceItemAddon" a
SET "qty" = i."quantity"
FROM "InvoiceItem" i
WHERE i."id" = a."invoiceItemId";

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "discountNominal" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "discountNominal" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "Invoice" SET "discountType" = 'NONE', "discountValue" = 0, "discountNominal" = 0;
UPDATE "SalesOrder" SET "discountType" = 'NONE', "discountValue" = 0, "discountNominal" = 0;
