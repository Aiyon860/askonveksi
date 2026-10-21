-- Revisi lanjutan R4: Add On boleh punya deskripsi opsional (sejajar dengan kolom Deskripsi produk).

ALTER TABLE "InvoiceItemAddon" ADD COLUMN IF NOT EXISTS "description" VARCHAR(240);
