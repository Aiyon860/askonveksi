BEGIN;

-- Pastikan metode pembayaran dasar tersedia (idempoten; abaikan jika namanya sudah ada).
INSERT INTO "PaymentMethod" ("id", "name", "position", "isActive", "createdAt", "updatedAt") VALUES
  ('payment-method-tunai', 'Tunai', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-qris', 'QRIS', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-bank-a', 'BANK A', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-bank-b', 'BANK B', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

ALTER TABLE "Expense" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "isReimbursable" BOOLEAN NOT NULL DEFAULT false;

-- Pengeluaran lama dengan metode PRIBADI menjadi "bisa diganti" dan metodenya dipetakan ke Tunai.
UPDATE "Expense" SET "isReimbursable" = true WHERE "paymentMethod" = 'PRIBADI';

UPDATE "Expense" AS e SET "paymentMethodId" = pm."id"
FROM "PaymentMethod" AS pm
WHERE LOWER(BTRIM(pm."name")) = CASE e."paymentMethod"
  WHEN 'QRIS' THEN 'qris'
  WHEN 'TUNAI' THEN 'tunai'
  WHEN 'BANK_A' THEN 'bank a'
  WHEN 'BANK_B' THEN 'bank b'
  WHEN 'PRIBADI' THEN 'tunai'
END;

-- Fallback bila metode tujuan tidak ditemukan agar tidak ada baris yang gagal NOT NULL.
UPDATE "Expense" SET "paymentMethodId" = (SELECT "id" FROM "PaymentMethod" ORDER BY "position" ASC, "name" ASC LIMIT 1)
WHERE "paymentMethodId" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "paymentMethodId" SET NOT NULL;
CREATE INDEX "Expense_paymentMethodId_spentAt_idx" ON "Expense"("paymentMethodId", "spentAt");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Expense_paymentMethod_spentAt_idx";
ALTER TABLE "Expense" DROP COLUMN "paymentMethod";
DROP TYPE IF EXISTS "ExpensePaymentMethod";

COMMIT;
