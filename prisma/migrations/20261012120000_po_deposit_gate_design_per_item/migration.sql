-- Sprint 2 revisi: checkbox Deposit pada form PO + upload desain per produk.
-- 1) "PurchaseOrder.depositRequired" menjadi gate tombol Isi Deposit (dicentang saat draft dibuat).
-- 2) "DesignRevision.itemId" menyimpan produk PO pemilik revisi, sehingga satu PO dengan 2+ produk
--    punya riwayat versi desain sendiri-sendiri.
-- Idempoten agar aman bila dijalankan ulang.

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "depositRequired" BOOLEAN NOT NULL DEFAULT false;

-- PO lama tetap membuka tombol Isi Deposit seperti sebelum revisi ini.
UPDATE "PurchaseOrder" SET "depositRequired" = true WHERE "depositRequired" = false;

ALTER TABLE "DesignRevision" ADD COLUMN IF NOT EXISTS "itemId" VARCHAR(40) NOT NULL DEFAULT '';

-- Revisi lama belum punya produk; tempelkan ke produk pertama PO agar status desain tetap terbaca.
UPDATE "DesignRevision" rev
SET "itemId" = item."id"
FROM "DesignTask" task
JOIN "PurchaseOrderItem" item ON item."purchaseOrderId" = task."purchaseOrderId" AND item."position" = 0
WHERE rev."designTaskId" = task."id" AND rev."itemId" = '';

DROP INDEX IF EXISTS "DesignRevision_designTaskId_revision_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DesignRevision_designTaskId_itemId_revision_key" ON "DesignRevision"("designTaskId", "itemId", "revision");
CREATE INDEX IF NOT EXISTS "DesignRevision_itemId_idx" ON "DesignRevision"("itemId");
