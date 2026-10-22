-- Poin "Pengaturan invoice" kini menyimpan format teks (tebal/miring/garis bawah)
-- sebagai fragmen HTML ringan. Data lama di-escape, baris baru jadi <br>, dan poin
-- yang bertanda tebal dibungkus <strong>; kolom isBold tidak dipakai lagi.
BEGIN;

UPDATE "InvoiceSettingPoint"
SET "text" = replace(replace(replace("text", '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

UPDATE "InvoiceSettingPoint"
SET "text" = replace(replace(replace("text", E'\r\n', E'\n'), E'\r', E'\n'), E'\n', '<br>');

UPDATE "InvoiceSettingPoint"
SET "text" = '<strong>' || "text" || '</strong>'
WHERE "isBold";

ALTER TABLE "InvoiceSettingPoint" DROP COLUMN "isBold";

COMMIT;
