-- Deadline pembayaran fleksibel:
-- - Jatuh tempo & deadline termin diisi manual, jadi kolom deadline dibuat nullable
--   (tanggal kosong = tanpa batas, tanpa peringatan terlambat).
-- - DealPayment menyimpan salinan deadline pembayaran awal (disalin dari jadwal saat finalize);
--   kolom lama diisi ulang dari jatuh tempo invoice terbit.
-- - Backfill: invoice terbit yang belum punya jadwal dan belum punya Sales Order
--   mendapat jadwal Lunas (100%) dengan deadline = jatuh tempo, sebelum jalur lama
--   (form Deal pasca-terbit) dihapus. Baris dengan deposit ≥ total sengaja dilewati:
--   sisa tagihan nol/negatif tidak memiliki representasi jadwal yang valid.
BEGIN;

ALTER TABLE "PendingDealPayment" ALTER COLUMN "initialDueAt" DROP NOT NULL;
ALTER TABLE "PendingPaymentTerm" ALTER COLUMN "dueAt" DROP NOT NULL;
ALTER TABLE "PaymentTerm" ALTER COLUMN "dueAt" DROP NOT NULL;

ALTER TABLE "DealPayment" ADD COLUMN "initialDueAt" DATE;

UPDATE "DealPayment" dp
SET "initialDueAt" = i."dueAt"
FROM "SalesOrder" s
JOIN "Invoice" i ON i.id = s."invoiceId"
WHERE dp."salesOrderId" = s.id
  AND i."dueAt" IS NOT NULL
  AND dp."initialDueAt" IS NULL;

INSERT INTO "PendingDealPayment" (
  id, "invoiceId", kind, "initialValueType", "initialValue", "initialAmount",
  "initialDueAt", "createdById", "createdAt", "updatedAt"
)
SELECT
  encode(gen_random_bytes(12), 'hex'),
  i.id,
  'LUNAS',
  'PERCENTAGE',
  100,
  i.total - COALESCE(d.amount, 0),
  i."dueAt",
  i."createdById",
  now(),
  now()
FROM "Invoice" i
LEFT JOIN "PurchaseOrderDeposit" d ON d."purchaseOrderId" = i."purchaseOrderId"
WHERE i.status = 'ISSUED'
  AND i."dueAt" IS NOT NULL
  AND i.total > COALESCE(d.amount, 0)
  AND NOT EXISTS (SELECT 1 FROM "SalesOrder" s WHERE s."invoiceId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM "PendingDealPayment" p WHERE p."invoiceId" = i.id);

COMMIT;
