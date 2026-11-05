-- Multi-brand: ASKONVEKSI + SAGA
-- Migrasi ini sengaja ditulis tangan agar hanya memuat perubahan brand.
-- Drift lain (index trigram, default updatedAt, urutan enum) tidak disentuh.
--
-- Ditulis idempoten (IF NOT EXISTS / DO block) karena Prisma tidak membungkus
-- seluruh DDL Postgres dalam satu transaksi: bila satu langkah gagal, langkah
-- sebelumnya bisa sudah ter-commit dan migrasi perlu dijalankan ulang.

-- 1. Enum brand
DO $$ BEGIN
  CREATE TYPE "Brand" AS ENUM ('ASKONVEKSI', 'SAGA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BrandScope" AS ENUM ('ASKONVEKSI', 'SAGA', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Brand pada akun
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';

-- 3. Brand pada entitas transaksional (data lama otomatis menjadi ASKONVEKSI)
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "CommunicationActivity" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "brandScope" "BrandScope" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "CustomerReminder" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "InvoiceSettingPoint" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "ProductCategory" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "ProductionWorkOrder" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "WhatsAppAutomationJob" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "WhatsAppCampaign" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "WhatsAppConversation" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "WhatsAppTemplate" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "brand" "Brand" NOT NULL DEFAULT 'ASKONVEKSI';

-- 4. Unik per brand untuk master data yang dulu unik global.
--    Unik case-insensitive lama (name_ci_key) juga harus digeser ke per-brand,
--    kalau tidak, nama kategori yang sama di SAGA akan ditolak.
DROP INDEX IF EXISTS "ProductCategory_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_brand_name_key" ON "ProductCategory"("brand", "name");

DROP INDEX IF EXISTS "ProductCategory_name_ci_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_brand_name_ci_key" ON "ProductCategory"("brand", LOWER(BTRIM("name")));

DROP INDEX IF EXISTS "WhatsAppTemplate_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppTemplate_brand_name_key" ON "WhatsAppTemplate"("brand", "name");

--    Satu template aktif per trigger, sekarang per brand.
DROP INDEX IF EXISTS "WhatsAppTemplate_one_active_trigger_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppTemplate_brand_one_active_trigger_key"
  ON "WhatsAppTemplate"("brand", "triggerType")
  WHERE "isActive" = true AND "triggerType" <> 'MANUAL';

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessProfile_brand_key" ON "BusinessProfile"("brand");

-- 5. Index bantu filter brand
CREATE INDEX IF NOT EXISTS "AppUser_brand_role_isActive_idx" ON "AppUser"("brand", "role", "isActive");
CREATE INDEX IF NOT EXISTS "AuditEvent_brand_createdAt_idx" ON "AuditEvent"("brand", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunicationActivity_brand_customerId_occurredAt_id_idx" ON "CommunicationActivity"("brand", "customerId", "occurredAt", "id");
CREATE INDEX IF NOT EXISTS "Customer_brandScope_archivedAt_updatedAt_idx" ON "Customer"("brandScope", "archivedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomerReminder_brand_resolvedAt_dueAt_idx" ON "CustomerReminder"("brand", "resolvedAt", "dueAt");
CREATE INDEX IF NOT EXISTS "Expense_brand_spentAt_idx" ON "Expense"("brand", "spentAt");
CREATE INDEX IF NOT EXISTS "Expense_brand_deletedAt_spentAt_idx" ON "Expense"("brand", "deletedAt", "spentAt");
CREATE INDEX IF NOT EXISTS "Invoice_brand_status_updatedAt_idx" ON "Invoice"("brand", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "InvoiceSettingPoint_brand_section_position_idx" ON "InvoiceSettingPoint"("brand", "section", "position");
CREATE INDEX IF NOT EXISTS "Opportunity_brand_stage_updatedAt_idx" ON "Opportunity"("brand", "stage", "updatedAt");
CREATE INDEX IF NOT EXISTS "ProductionWorkOrder_brand_status_updatedAt_idx" ON "ProductionWorkOrder"("brand", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_brand_status_updatedAt_idx" ON "PurchaseOrder"("brand", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "SalesOrder_brand_status_acceptedAt_idx" ON "SalesOrder"("brand", "status", "acceptedAt");
CREATE INDEX IF NOT EXISTS "WhatsAppAccount_brand_sendEnabled_status_idx" ON "WhatsAppAccount"("brand", "sendEnabled", "status");
CREATE INDEX IF NOT EXISTS "WhatsAppAutomationJob_brand_status_scheduledAt_idx" ON "WhatsAppAutomationJob"("brand", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaign_brand_status_scheduledAt_idx" ON "WhatsAppCampaign"("brand", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_brand_lastMessageAt_idx" ON "WhatsAppConversation"("brand", "lastMessageAt");

-- 6. Profil bisnis kini satu baris per brand. Constraint lama mengunci id ke
--    'default' sehingga baris SAGA selalu ditolak; ganti dengan unique brand.
ALTER TABLE "BusinessProfile" DROP CONSTRAINT IF EXISTS "BusinessProfile_singleton";

-- Seed profil SAGA dari profil ASKONVEKSI.
-- Nama, logo, dan tanda tangan dikosongkan agar bisa diisi identitas SAGA.
INSERT INTO "BusinessProfile" (
  "id", "brand", "name", "phone", "email", "address",
  "logoPath", "signaturePath", "signatureName", "signatureTitle", "invoiceNotes",
  "invoiceReminderOffsets", "repeatOrderIntervals",
  "attendanceStartDate", "attendanceCheckInTime", "attendanceLateToleranceMin", "attendanceWorkDays",
  "version", "createdAt", "updatedAt"
)
SELECT
  'saga', 'SAGA', 'SAGA', "phone", "email", "address",
  NULL, NULL, NULL, NULL, "invoiceNotes",
  "invoiceReminderOffsets", "repeatOrderIntervals",
  "attendanceStartDate", "attendanceCheckInTime", "attendanceLateToleranceMin", "attendanceWorkDays",
  1, NOW(), NOW()
FROM "BusinessProfile"
WHERE "brand" = 'ASKONVEKSI'
ON CONFLICT ("brand") DO NOTHING;

-- 7. Salin master data per brand dari ASKONVEKSI ke SAGA.
-- Guard NOT EXISTS membuat langkah ini aman dijalankan ulang.
INSERT INTO "ProductCategory" ("id", "brand", "name", "garmentType", "position", "isActive", "createdAt", "updatedAt")
SELECT
  'saga_' || replace(gen_random_uuid()::text, '-', ''),
  'SAGA', source."name", source."garmentType", source."position", source."isActive", NOW(), NOW()
FROM "ProductCategory" source
WHERE source."brand" = 'ASKONVEKSI'
  AND NOT EXISTS (
    SELECT 1 FROM "ProductCategory" existing
    WHERE existing."brand" = 'SAGA' AND existing."name" = source."name"
  )
ON CONFLICT ("brand", "name") DO NOTHING;

INSERT INTO "InvoiceSettingPoint" ("id", "brand", "section", "text", "position", "createdAt", "updatedAt")
SELECT
  'saga_' || replace(gen_random_uuid()::text, '-', ''),
  'SAGA', source."section", source."text", source."position", NOW(), NOW()
FROM "InvoiceSettingPoint" source
WHERE source."brand" = 'ASKONVEKSI'
  AND NOT EXISTS (
    SELECT 1 FROM "InvoiceSettingPoint" existing
    WHERE existing."brand" = 'SAGA'
      AND existing."section" = source."section"
      AND existing."text" = source."text"
  );

INSERT INTO "WhatsAppTemplate" (
  "id", "brand", "name", "triggerType", "body", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  'saga_' || replace(gen_random_uuid()::text, '-', ''),
  'SAGA', source."name", source."triggerType", source."body", source."isActive",
  NOW(), NOW()
FROM "WhatsAppTemplate" source
WHERE source."brand" = 'ASKONVEKSI'
  AND NOT EXISTS (
    SELECT 1 FROM "WhatsAppTemplate" existing
    WHERE existing."brand" = 'SAGA' AND existing."name" = source."name"
  )
ON CONFLICT ("brand", "name") DO NOTHING;

-- 8. Penomoran lama dipindahkan ke namespace ASKONVEKSI
UPDATE "SequenceCounter"
SET "key" = 'ASKONVEKSI:' || "key"
WHERE "key" NOT LIKE 'ASKONVEKSI:%'
  AND "key" NOT LIKE 'SAGA:%';
