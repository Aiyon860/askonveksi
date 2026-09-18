CREATE TYPE "ExpenseCategory" AS ENUM (
  'WIFI', 'LINGKUNGAN', 'ADS', 'CICILAN_LAPTOP', 'FREE_PICK', 'ONGKIR_CUST',
  'ONGKIR_ADMIN_PRODUKSI', 'LISTRIK_DEPAN', 'LISTRIK_BELAKANG', 'PERALATAN_KANTOR',
  'SAMPEL', 'KONTEN', 'MEETING', 'EVENT_IFANA_SAGA', 'GOSEND_MOBIL_PRODUKSI',
  'LEMBUR', 'LOKER', 'DLL'
);

ALTER TABLE "Expense" ADD COLUMN "category" "ExpenseCategory";
UPDATE "Expense" SET "category" = 'DLL' WHERE "category" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "category" SET NOT NULL;
CREATE INDEX "Expense_category_spentAt_idx" ON "Expense"("category", "spentAt");
