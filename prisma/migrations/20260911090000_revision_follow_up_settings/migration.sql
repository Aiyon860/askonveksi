ALTER TABLE "BusinessProfile"
  ADD COLUMN "invoiceReminderOffsets" INTEGER[] NOT NULL DEFAULT ARRAY[-3, 0, 3]::INTEGER[];

ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_invoice_reminder_offsets_valid"
  CHECK (
    cardinality("invoiceReminderOffsets") = 3
    AND "invoiceReminderOffsets"[1] <> "invoiceReminderOffsets"[2]
    AND "invoiceReminderOffsets"[1] <> "invoiceReminderOffsets"[3]
    AND "invoiceReminderOffsets"[2] <> "invoiceReminderOffsets"[3]
  );

ALTER TABLE "Customer"
  ADD COLUMN "orderReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "WhatsAppTemplate"
  ALTER COLUMN "createdById" DROP NOT NULL,
  ALTER COLUMN "updatedById" DROP NOT NULL;

DROP INDEX "WhatsAppTemplate_one_active_trigger_key";
CREATE UNIQUE INDEX "WhatsAppTemplate_one_active_trigger_key"
  ON "WhatsAppTemplate"("triggerType")
  WHERE "isActive" = true AND "triggerType" <> 'MANUAL';

UPDATE "WhatsAppTemplate"
SET "isActive" = false, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "triggerType" = 'REPEAT_ORDER' AND "isActive" = true;

UPDATE "CustomerReminder"
SET "resolvedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'REPEAT_ORDER' AND "resolvedAt" IS NULL;

UPDATE "WhatsAppAutomationJob"
SET "status" = 'CANCELLED', "lastError" = 'Fitur repeat order telah dinonaktifkan.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'REPEAT_ORDER' AND "status" IN ('QUEUED', 'RETRY', 'PROCESSING');

UPDATE "WhatsAppMessage"
SET "status" = 'CANCELLED', "errorMessage" = 'Fitur repeat order telah dinonaktifkan.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "automationJobId" IN (
  SELECT "id" FROM "WhatsAppAutomationJob" WHERE "type" = 'REPEAT_ORDER'
) AND "status" IN ('QUEUED', 'SENDING');

INSERT INTO "WhatsAppTemplate" ("id", "name", "triggerType", "body", "isActive", "version", "createdAt", "updatedAt") VALUES
  ('system-template-welcome', 'Selamat datang customer baru', 'MANUAL', 'Halo {{customer_name}}, selamat datang di {{business_name}}. Kami siap membantu kebutuhan produksi Anda. Silakan sampaikan produk dan kebutuhan yang ingin dibuat.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system-template-customer-production', 'Lengkapi data customer dan produksi', 'MANUAL', E'Halo {{customer_name}}, agar pesanan dapat kami proses, mohon kirim data berikut.\n\nData customer: nama/perusahaan, nomor WhatsApp, email atau Instagram, dan alamat.\n\nData produksi/PO: jenis produk, bahan, warna, metode dekorasi, ukuran beserta jumlah, catatan desain, dan deadline.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system-template-customer', 'Lengkapi data customer', 'MANUAL', 'Halo {{customer_name}}, mohon bantu lengkapi data customer: nama/perusahaan, nomor WhatsApp, email atau Instagram, dan alamat.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system-template-production', 'Lengkapi data produksi/PO', 'MANUAL', 'Halo {{customer_name}}, mohon kirim detail produksi/PO: jenis produk, bahan, warna, metode dekorasi, ukuran beserta jumlah, catatan desain, dan deadline.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "WhatsAppTemplate" ("id", "name", "triggerType", "body", "isActive", "version", "createdAt", "updatedAt")
SELECT 'system-template-invoice-issued', 'Invoice diterbitkan', 'INVOICE_ISSUED', 'Halo {{customer_name}}, invoice {{invoice_no}} dari {{business_name}} sebesar {{invoice_total}} telah diterbitkan. Batas pembayaran: {{invoice_due_date}}. Dokumen invoice terlampir. Mohon konfirmasi setelah pembayaran. Terima kasih.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "triggerType" = 'INVOICE_ISSUED' AND "isActive" = true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "WhatsAppTemplate" ("id", "name", "triggerType", "body", "isActive", "version", "createdAt", "updatedAt")
SELECT 'system-template-invoice-due', 'Pengingat pembayaran invoice', 'INVOICE_DUE', 'Halo {{customer_name}}, pengingat pembayaran {{payment_label}} untuk invoice {{invoice_no}} sebesar {{payment_amount}} jatuh tempo pada {{payment_due_date}}. Mohon konfirmasi setelah pembayaran. Terima kasih.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "triggerType" = 'INVOICE_DUE' AND "isActive" = true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "WhatsAppTemplate" ("id", "name", "triggerType", "body", "isActive", "version", "createdAt", "updatedAt")
SELECT 'system-template-order-reminder', 'Pengingat order enam bulan', 'REACTIVATION', 'Halo {{customer_name}}, sudah enam bulan sejak order terakhir di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "triggerType" = 'REACTIVATION' AND "isActive" = true)
ON CONFLICT ("name") DO NOTHING;
