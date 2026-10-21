-- Revisi R5: poin Keterangan & Syarat/Ketentuan di master "Pengaturan invoice"
-- jadi teks multi-baris (textarea). Perpanjang kolom dari VARCHAR(300) ke TEXT.

ALTER TABLE "InvoiceSettingPoint" ALTER COLUMN "text" TYPE TEXT;
