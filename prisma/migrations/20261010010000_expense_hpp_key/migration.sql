-- A+F: penanda baris HPP pada Expense Project agar data lama tampil lagi saat Edit HPP.
-- Idempoten agar aman bila dijalankan ulang.

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "hppKey" VARCHAR(32);
CREATE INDEX IF NOT EXISTS "Expense_salesOrderId_hppKey_idx" ON "Expense"("salesOrderId", "hppKey");
