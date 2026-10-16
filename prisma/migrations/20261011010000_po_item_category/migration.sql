-- Sprint 2 revisi: kategori produk per item PO (2 jenis produk berbeda dalam 1 PO).
-- garmentType didenormalisasi per item agar WO/PDF tidak perlu join tambahan.
-- Idempoten agar aman bila dijalankan ulang.

ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "productCategoryId" TEXT;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "garmentType" "GarmentType";

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_productCategoryId_idx" ON "PurchaseOrderItem"("productCategoryId");
