-- Sprint 2 (C+E): Instansi+Pola, dekorasi multi, item PO, WO per item, tracking kirim/konfirmasi PO.
-- Idempoten agar aman bila dijalankan ulang.

-- 1. PurchaseOrder: instansi + pola (backfill pola dari productName).
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "instansi" VARCHAR(160);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "pola" VARCHAR(120);
UPDATE "PurchaseOrder" SET "pola" = "productName" WHERE "pola" IS NULL;

-- 2. PurchaseOrder: dekorasi multi (backfill dari decorationMethod tunggal).
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "decorationMethods" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "PurchaseOrder" SET "decorationMethods" = ARRAY["decorationMethod"] WHERE "decorationMethod" IS NOT NULL AND "decorationMethods" = '{}';

-- 3. PurchaseOrder: tracking kirim PDF + konfirmasi customer (E2).
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "designSentAt" TIMESTAMPTZ(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "designSentById" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "customerConfirmedAt" TIMESTAMPTZ(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "customerConfirmedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_designSentById_fkey" FOREIGN KEY ("designSentById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_customerConfirmedById_fkey" FOREIGN KEY ("customerConfirmedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Item PO (C2): satu PO bisa memuat N produk/desain dalam satu warna.
CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "decorationMethods" TEXT[] NOT NULL DEFAULT '{}',
  "designNotes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_position_key" ON "PurchaseOrderItem"("purchaseOrderId", "position");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tandai baris matriks & roster milik item mana ("" = data lama / item tunggal).
ALTER TABLE "PurchaseOrderSize" ADD COLUMN IF NOT EXISTS "itemId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PurchaseOrderRosterEntry" ADD COLUMN IF NOT EXISTS "itemId" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "PurchaseOrderSize_purchaseOrderId_sleeveLength_size_key";
DROP INDEX IF EXISTS "PurchaseOrderRosterEntry_purchaseOrderId_memberId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderSize_po_item_sleeve_size_key" ON "PurchaseOrderSize"("purchaseOrderId", "itemId", "sleeveLength", "size");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderRosterEntry_po_item_member_key" ON "PurchaseOrderRosterEntry"("purchaseOrderId", "itemId", "memberId");

-- 5. WO per item (1:N ke SalesOrder).
ALTER TABLE "ProductionWorkOrder" ADD COLUMN IF NOT EXISTS "purchaseOrderItemId" TEXT;
ALTER TABLE "ProductionWorkOrder" ADD COLUMN IF NOT EXISTS "itemName" VARCHAR(160);

DO $$ BEGIN
  ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "ProductionWorkOrder_salesOrderId_key";
CREATE INDEX IF NOT EXISTS "ProductionWorkOrder_salesOrderId_idx" ON "ProductionWorkOrder"("salesOrderId");
