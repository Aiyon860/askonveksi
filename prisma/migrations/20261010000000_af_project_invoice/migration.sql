-- A+F: Project (HPP->Pengeluaran, filter customer/tipe, soft-delete) + Invoice (pajak, rekening, TTD, deposit)
-- Idempoten agar aman bila dijalankan ulang.

-- 1. Enum baru
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PROJECT';
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'DEPOSIT';

-- 2. Expense: relasi project/customer + soft-delete
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "customerName" VARCHAR(160);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_deletedAt_spentAt_idx" ON "Expense"("deletedAt", "spentAt");
CREATE INDEX IF NOT EXISTS "Expense_salesOrderId_idx" ON "Expense"("salesOrderId");
CREATE INDEX IF NOT EXISTS "Expense_customerName_idx" ON "Expense"("customerName");

-- 3. BusinessProfile: rekening + tanda tangan + template invoice
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "bankName" VARCHAR(120);
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "bankAccountNumber" VARCHAR(60);
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "bankAccountHolder" VARCHAR(160);
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "signatureName" VARCHAR(160);
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "signatureTitle" VARCHAR(120);
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "invoiceNotes" TEXT;

-- 4. Invoice: pajak + snapshot rekening/TTD
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "snapshotBankName" VARCHAR(120);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "snapshotBankAccountNumber" VARCHAR(60);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "snapshotBankAccountHolder" VARCHAR(160);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "snapshotSignatureName" VARCHAR(160);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "snapshotSignatureTitle" VARCHAR(120);

-- 5. SalesOrder: salin pajak + diskon untuk laporan
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "totalDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
