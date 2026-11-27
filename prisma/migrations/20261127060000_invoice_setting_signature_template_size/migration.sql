-- Template invoice memakai gambar tanda tangan 76 × 66 px (57 × 49,5 pt).
ALTER TABLE "InvoiceSetting" ALTER COLUMN "signatureWidth" SET DEFAULT 57;
ALTER TABLE "InvoiceSetting" ALTER COLUMN "signatureHeight" SET DEFAULT 50;

-- Baris yang masih memakai default lama (220 × 64) belum pernah diubah admin;
-- samakan dengan ukuran template baru.
UPDATE "InvoiceSetting"
SET "signatureWidth" = 57, "signatureHeight" = 50
WHERE "signatureWidth" = 220 AND "signatureHeight" = 64;
