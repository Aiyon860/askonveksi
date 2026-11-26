-- Ukuran font bersama untuk blok Keterangan & Syarat & Ketentuan pada PDF invoice.
-- Satu baris per brand; data lama memakai 12 pt.

BEGIN;

CREATE TABLE IF NOT EXISTS "InvoiceSetting" (
  "id" VARCHAR(64) NOT NULL,
  "brand" "Brand" NOT NULL,
  "pointFontSize" INTEGER NOT NULL DEFAULT 12,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSetting_brand_key" ON "InvoiceSetting"("brand");

INSERT INTO "InvoiceSetting" ("id", "brand", "pointFontSize", "updatedAt")
VALUES ('invoice-setting-askonveksi', 'ASKONVEKSI', 12, NOW()), ('invoice-setting-saga', 'SAGA', 12, NOW())
ON CONFLICT ("brand") DO NOTHING;

COMMIT;
