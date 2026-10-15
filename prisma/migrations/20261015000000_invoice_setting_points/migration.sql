-- Master data "Pengaturan invoice": dua kolom (Keterangan & Syarat/Ketentuan)
-- berisi poin-poin yang dicetak pada PDF invoice. Urutan manual per kolom dan
-- penanda bold disimpan di barisnya sendiri.
BEGIN;

CREATE TYPE "InvoiceSettingSection" AS ENUM ('KETERANGAN', 'SYARAT_KETENTUAN');

CREATE TABLE "InvoiceSettingPoint" (
  "id" TEXT NOT NULL,
  "section" "InvoiceSettingSection" NOT NULL,
  "text" VARCHAR(300) NOT NULL,
  "isBold" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "InvoiceSettingPoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceSettingPoint_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "InvoiceSettingPoint_text_not_blank" CHECK (NULLIF(BTRIM("text"), '') IS NOT NULL)
);

CREATE INDEX "InvoiceSettingPoint_section_position_idx" ON "InvoiceSettingPoint"("section", "position");

ALTER TABLE "InvoiceSettingPoint" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InvoiceSettingPoint" FROM anon, authenticated;

COMMIT;
