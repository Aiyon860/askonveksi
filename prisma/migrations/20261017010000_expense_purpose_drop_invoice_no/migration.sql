-- Revisi R18: teks Keperluan pengeluaran HPP tidak lagi memuat nomor invoice.
-- Bersihkan data lama (termasuk baris Riwayat Hapus) sekali jalan: buang segmen
-- " · INV-..." di ekor purpose yang dihasilkan alur Edit HPP.
UPDATE "Expense"
SET purpose = regexp_replace(purpose, ' · INV-[^·]*$', '')
WHERE purpose LIKE 'HPP %'
  AND purpose ~ ' · INV-[^·]*$';
