-- Sprint 2 revisi: deposit desain per PO.
-- Deposit dicatat langsung pada PO (sebelum invoice/Sales Order ada) dan membuka Upload Desain.
-- Nominalnya dikurangkan dari sisa tagihan saat jadwal pembayaran invoice disusun.
-- Idempoten agar aman bila dijalankan ulang.

CREATE TABLE IF NOT EXISTS "PurchaseOrderDeposit" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidAt" TIMESTAMPTZ(3) NOT NULL,
  "paymentMethodId" TEXT,
  "reference" VARCHAR(120),
  "note" VARCHAR(1000),
  "proofPath" VARCHAR(500),
  "proofFileName" VARCHAR(255),
  "proofMimeType" VARCHAR(100),
  "proofSize" INTEGER,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "PurchaseOrderDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderDeposit_purchaseOrderId_key" ON "PurchaseOrderDeposit"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderDeposit_paidAt_idx" ON "PurchaseOrderDeposit"("paidAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrderDeposit_createdById_createdAt_idx" ON "PurchaseOrderDeposit"("createdById", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderDeposit" ADD CONSTRAINT "PurchaseOrderDeposit_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderDeposit" ADD CONSTRAINT "PurchaseOrderDeposit_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderDeposit" ADD CONSTRAINT "PurchaseOrderDeposit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
