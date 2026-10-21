-- Deskripsi opsional per baris pengeluaran (R15/R17): baris HPP multi-Kain dst.
BEGIN;

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "description" VARCHAR(240);

COMMIT;
