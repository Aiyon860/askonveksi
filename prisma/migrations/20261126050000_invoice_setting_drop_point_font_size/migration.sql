-- Ukuran font Keterangan & S&K sekarang diatur per fragmen teks di editor,
-- jadi kolom ukuran global tidak dipakai lagi.

BEGIN;

ALTER TABLE "InvoiceSetting" DROP COLUMN IF EXISTS "pointFontSize";

COMMIT;
