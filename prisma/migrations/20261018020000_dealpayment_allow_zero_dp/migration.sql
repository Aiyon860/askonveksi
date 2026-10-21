-- R7: izinkan DP Rp 0 pada Sales Order yang sudah terbentuk.
-- Jadwal DP Rp 0 langsung membentuk Sales Order + Work Order tanpa transaksi
-- pembayaran awal, sehingga nilai awal dan pembayaran awal boleh bernilai nol.
-- Termin tetap wajib bernilai positif (menutup sisa tagihan dengan tepat).
BEGIN;

ALTER TABLE "DealPayment" DROP CONSTRAINT "DealPayment_values_valid";

ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_values_valid" CHECK (
  "initialValue" >= 0 AND "initialAmount" >= 0 AND "outstandingAmount" >= 0 AND
  ("initialValueType" <> 'PERCENTAGE' OR "initialValue" <= 100)
);

COMMIT;
