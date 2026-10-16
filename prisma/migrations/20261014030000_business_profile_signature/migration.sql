-- Field rekening dihapus dari profil perusahaan: sumbernya pindah ke master
-- Metode pembayaran (nama + deskripsi). Snapshot rekening lama di tabel Invoice
-- tetap dipertahankan agar dokumen yang sudah dikunci tidak berubah isinya.
ALTER TABLE "BusinessProfile"
DROP COLUMN "bankName",
DROP COLUMN "bankAccountNumber",
DROP COLUMN "bankAccountHolder";

-- Gambar tanda tangan: disimpan di bucket business-assets, dicetak di atas
-- nama pada PDF invoice dan kwitansi.
ALTER TABLE "BusinessProfile" ADD COLUMN "signaturePath" VARCHAR(500);

-- Snapshot gambar tanda tangan mengikuti prinsip dokumen terkunci.
ALTER TABLE "Invoice" ADD COLUMN "snapshotSignaturePath" VARCHAR(500);
