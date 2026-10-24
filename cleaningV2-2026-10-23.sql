-- ============================================================
-- CLEANING DATA V2 — 17 Okt 2026 s.d. hari ini (Asia/Jakarta)
-- Dibuat: 23 Okt 2026. Jalankan manual via Supabase SQL Editor.
--
-- CAKUPAN (sama seperti cleaning-2026-10-16.sql + absensi):
--   Customer baru (createdAt >= 17 Okt), Opportunity, PurchaseOrder
--   (+item/size/roster/lampiran/deposit), desain (+revisi/lampiran),
--   Invoice (+item/addon), SalesOrder (+item/cost), pembayaran
--   (DealPayment/PaymentTerm/PaymentTransaction/Pending*),
--   ProductionWorkOrder (+step/activity), Expense, CustomerReminder
--   (+receipt), CommunicationActivity, WhatsApp (chat/message/job/
--   campaign), Attendance, AuditEvent, PublicRateLimitBucket.
--
-- DIPERTAHANKAN:
--   AppUser, BusinessProfile, CustomerType, LeadSource, GarmentSize,
--   PaymentMethod, ProductCategory, InvoiceSettingPoint,
--   AttendanceHoliday, WhatsAppAccount, WhatsAppTemplate,
--   seluruh Customer lama (createdAt < 17 Okt).
--
-- KHUSUS KEUANGAN:
--   - Expense dihapus berdasarkan "spentAt" (bukan createdAt), sehingga
--     pengeluaran Agustus yang diinput ulang bulan ini TETAP ADA.
--   - Script BATAL bila ada DealPayment/PaymentTransaction bertanggal
--     sebelum 17 Okt yang menempel pada SalesOrder yang akan dihapus.
--   - Expense Agustus yang terhubung ke SalesOrder yang dihapus tetap
--     ada, tetapi tautan project-nya menjadi NULL (FK SetNull).
--
-- CATATAN: file fisik di Supabase Storage TIDAK ikut terhapus.
--   Script menampilkan daftar path terkait; hapus file via Storage API.
--
-- CARA PAKAI:
--   1. Backup/PITR database dulu.
--   2. Uji kering: ganti "COMMIT;" di akhir menjadi "ROLLBACK;" lalu jalankan.
--      Semua delete + guard tetap dieksekusi, tetapi dibatalkan di akhir.
--   3. Setelah hasil ringkasan cocok, jalankan lagi dengan "COMMIT;".
--   4. Jika guard keuangan berbunyi, seluruh transaksi otomatis rollback.
-- ============================================================
BEGIN;

SET LOCAL statement_timeout = '10min';
SET LOCAL lock_timeout = '30s';

-- ----------------------------------------------------------------------------
-- 0. PARAMETER WAKTU
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _cut AS
SELECT
  timestamptz '2026-10-17 00:00:00+07' AS start_at,
  now()                                 AS end_at,
  date '2026-10-17'                     AS start_date,
  (now() AT TIME ZONE 'Asia/Jakarta')::date AS end_date;

-- ----------------------------------------------------------------------------
-- 1. ANCHOR: id yang akan dihapus (closure: anak ikut walau tanggalnya lama)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _del_customer AS
SELECT id FROM "Customer"
WHERE "createdAt" >= (SELECT start_at FROM _cut)
  AND "createdAt" <  (SELECT end_at FROM _cut);

CREATE TEMP TABLE _del_opp AS
SELECT id FROM "Opportunity"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "customerId" IN (SELECT id FROM _del_customer);

CREATE TEMP TABLE _del_po AS
SELECT id FROM "PurchaseOrder"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "opportunityId" IN (SELECT id FROM _del_opp);

CREATE TEMP TABLE _del_inv AS
SELECT id FROM "Invoice"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "opportunityId" IN (SELECT id FROM _del_opp)
   OR "purchaseOrderId" IN (SELECT id FROM _del_po);

CREATE TEMP TABLE _del_so AS
SELECT id FROM "SalesOrder"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "opportunityId" IN (SELECT id FROM _del_opp)
   OR "purchaseOrderId" IN (SELECT id FROM _del_po)
   OR "invoiceId" IN (SELECT id FROM _del_inv);

CREATE TEMP TABLE _del_wo AS
SELECT id FROM "ProductionWorkOrder"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "salesOrderId" IN (SELECT id FROM _del_so);

CREATE TEMP TABLE _del_reminder AS
SELECT id FROM "CustomerReminder"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "sourceSalesOrderId" IN (SELECT id FROM _del_so)
   OR "customerId" IN (SELECT id FROM _del_customer);

CREATE TEMP TABLE _del_campaign AS
SELECT id FROM "WhatsAppCampaign"
WHERE "createdAt" >= (SELECT start_at FROM _cut)
  AND "createdAt" <  (SELECT end_at FROM _cut);

CREATE TEMP TABLE _del_job AS
SELECT id FROM "WhatsAppAutomationJob"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "opportunityId" IN (SELECT id FROM _del_opp)
   OR "invoiceId" IN (SELECT id FROM _del_inv)
   OR "reminderId" IN (SELECT id FROM _del_reminder)
   OR "campaignId" IN (SELECT id FROM _del_campaign)
   OR "customerId" IN (SELECT id FROM _del_customer);

CREATE TEMP TABLE _del_convo AS
SELECT id FROM "WhatsAppConversation"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "customerId" IN (SELECT id FROM _del_customer);

CREATE TEMP TABLE _del_msg AS
SELECT id FROM "WhatsAppMessage"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "conversationId" IN (SELECT id FROM _del_convo)
   OR "automationJobId" IN (SELECT id FROM _del_job);

-- Keuangan: pakai tanggal bisnis (spentAt) agar data Agustus aman.
CREATE TEMP TABLE _del_expense AS
SELECT id FROM "Expense"
WHERE "spentAt" >= (SELECT start_date FROM _cut)
  AND "spentAt" <= (SELECT end_date FROM _cut);

CREATE TEMP TABLE _del_attendance AS
SELECT id FROM "Attendance"
WHERE "date" >= (SELECT start_date FROM _cut)
  AND "date" <= (SELECT end_date FROM _cut);

CREATE TEMP TABLE _del_comm AS
SELECT id FROM "CommunicationActivity"
WHERE ("createdAt" >= (SELECT start_at FROM _cut) AND "createdAt" < (SELECT end_at FROM _cut))
   OR "opportunityId" IN (SELECT id FROM _del_opp)
   OR "customerId" IN (SELECT id FROM _del_customer);

-- ----------------------------------------------------------------------------
-- 2. RINGKASAN SEBELUM DELETE (review dulu; transaksi tetap bisa ROLLBACK)
-- ----------------------------------------------------------------------------
SELECT 'AKAN DIHAPUS' AS fase, 'Customer' AS tbl, count(*) AS jumlah FROM _del_customer
UNION ALL SELECT 'AKAN DIHAPUS', 'Opportunity', count(*) FROM _del_opp
UNION ALL SELECT 'AKAN DIHAPUS', 'PurchaseOrder', count(*) FROM _del_po
UNION ALL SELECT 'AKAN DIHAPUS', 'Invoice', count(*) FROM _del_inv
UNION ALL SELECT 'AKAN DIHAPUS', 'SalesOrder', count(*) FROM _del_so
UNION ALL SELECT 'AKAN DIHAPUS', 'ProductionWorkOrder', count(*) FROM _del_wo
UNION ALL SELECT 'AKAN DIHAPUS', 'CustomerReminder', count(*) FROM _del_reminder
UNION ALL SELECT 'AKAN DIHAPUS', 'WhatsAppCampaign', count(*) FROM _del_campaign
UNION ALL SELECT 'AKAN DIHAPUS', 'WhatsAppAutomationJob', count(*) FROM _del_job
UNION ALL SELECT 'AKAN DIHAPUS', 'WhatsAppConversation', count(*) FROM _del_convo
UNION ALL SELECT 'AKAN DIHAPUS', 'WhatsAppMessage', count(*) FROM _del_msg
UNION ALL SELECT 'AKAN DIHAPUS', 'DealPayment', count(*) FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so)
UNION ALL SELECT 'AKAN DIHAPUS', 'PaymentTransaction', count(*) FROM "PaymentTransaction"
  WHERE "paymentId" IN (SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so))
UNION ALL SELECT 'AKAN DIHAPUS', 'PurchaseOrderDeposit', count(*) FROM "PurchaseOrderDeposit"
  WHERE "purchaseOrderId" IN (SELECT id FROM _del_po)
UNION ALL SELECT 'AKAN DIHAPUS', 'Expense (spentAt >= 17 Okt)', count(*) FROM _del_expense
UNION ALL SELECT 'AKAN DIHAPUS', 'Attendance (17 Okt s.d. hari ini)', count(*) FROM _del_attendance
UNION ALL SELECT 'AKAN DIHAPUS', 'CommunicationActivity', count(*) FROM _del_comm
ORDER BY tbl;

-- Daftar file Storage terkait (catat hasilnya SEBELUM baris terhapus).
SELECT 'crm-po-designs: PurchaseOrderAttachment' AS bucket_path, "path" FROM "PurchaseOrderAttachment"
WHERE "purchaseOrderId" IN (SELECT id FROM _del_po)
UNION ALL
SELECT 'crm-po-designs: DesignAttachment', "path" FROM "DesignAttachment"
WHERE "designRevisionId" IN (
  SELECT r.id FROM "DesignRevision" r
  JOIN "DesignTask" t ON t.id = r."designTaskId"
  WHERE t."purchaseOrderId" IN (SELECT id FROM _del_po)
)
UNION ALL
SELECT 'crm-po-designs: DesignAttachment original', "originalPath" FROM "DesignAttachment"
WHERE "originalPath" IS NOT NULL AND "designRevisionId" IN (
  SELECT r.id FROM "DesignRevision" r
  JOIN "DesignTask" t ON t.id = r."designTaskId"
  WHERE t."purchaseOrderId" IN (SELECT id FROM _del_po)
)
UNION ALL
SELECT 'crm-po-designs: Desain penjahit', "penjahitDesignPath" FROM "PurchaseOrderItem"
WHERE "penjahitDesignPath" IS NOT NULL AND "purchaseOrderId" IN (SELECT id FROM _del_po)
UNION ALL
SELECT 'payment-proofs: Expense', "proofPath" FROM "Expense"
WHERE "proofPath" IS NOT NULL AND id IN (SELECT id FROM _del_expense)
UNION ALL
SELECT 'payment-proofs: Deposit PO', "proofPath" FROM "PurchaseOrderDeposit"
WHERE "proofPath" IS NOT NULL AND "purchaseOrderId" IN (SELECT id FROM _del_po)
UNION ALL
SELECT 'payment-proofs: PaymentTransaction', "proofPath" FROM "PaymentTransaction"
WHERE "proofPath" IS NOT NULL AND "paymentId" IN (
  SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so)
)
UNION ALL
SELECT 'whatsapp-media: WhatsAppMessage', "mediaPath" FROM "WhatsAppMessage"
WHERE "mediaPath" IS NOT NULL AND id IN (SELECT id FROM _del_msg)
UNION ALL
SELECT 'filesystem: Attendance (bukan Supabase Storage)', "photoPath" FROM "Attendance"
WHERE "photoPath" IS NOT NULL AND id IN (SELECT id FROM _del_attendance)
ORDER BY bucket_path;

-- ----------------------------------------------------------------------------
-- 3. GUARD: data yang WAJIB utuh + pengaman keuangan sebelum 17 Okt
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _guard_master AS
SELECT 'AppUser' AS tbl, count(*) AS c FROM "AppUser"
UNION ALL SELECT 'BusinessProfile', count(*) FROM "BusinessProfile"
UNION ALL SELECT 'CustomerType', count(*) FROM "CustomerType"
UNION ALL SELECT 'LeadSource', count(*) FROM "LeadSource"
UNION ALL SELECT 'GarmentSize', count(*) FROM "GarmentSize"
UNION ALL SELECT 'PaymentMethod', count(*) FROM "PaymentMethod"
UNION ALL SELECT 'ProductCategory', count(*) FROM "ProductCategory"
UNION ALL SELECT 'InvoiceSettingPoint', count(*) FROM "InvoiceSettingPoint"
UNION ALL SELECT 'AttendanceHoliday', count(*) FROM "AttendanceHoliday"
UNION ALL SELECT 'WhatsAppAccount', count(*) FROM "WhatsAppAccount"
UNION ALL SELECT 'WhatsAppTemplate', count(*) FROM "WhatsAppTemplate";

CREATE TEMP TABLE _guard_finance AS
SELECT 'Expense:spentAt<start' AS tbl, count(*) AS c FROM "Expense"
WHERE "spentAt" < (SELECT start_date FROM _cut)
UNION ALL SELECT 'DealPayment:paidAt<start', count(*) FROM "DealPayment"
WHERE "paidAt" < (SELECT start_at FROM _cut)
UNION ALL SELECT 'PaymentTransaction:paidAt<start', count(*) FROM "PaymentTransaction"
WHERE "paidAt" < (SELECT start_at FROM _cut)
UNION ALL SELECT 'PurchaseOrderDeposit:paidAt<start', count(*) FROM "PurchaseOrderDeposit"
WHERE "paidAt" < (SELECT start_at FROM _cut)
UNION ALL SELECT 'Customer:createdAt<start', count(*) FROM "Customer"
WHERE "createdAt" < (SELECT start_at FROM _cut);

DO $$
DECLARE
  bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM "PaymentTransaction" t
  JOIN "DealPayment" p ON p.id = t."paymentId"
  WHERE p."salesOrderId" IN (SELECT id FROM _del_so)
    AND t."paidAt" < (SELECT start_at FROM _cut);
  IF bad > 0 THEN
    RAISE EXCEPTION 'BATAL: ada % transaksi pembayaran sebelum 17 Okt pada SalesOrder yang akan dihapus. Data keuangan lama harus dipertahankan.', bad;
  END IF;

  SELECT count(*) INTO bad
  FROM "DealPayment"
  WHERE "salesOrderId" IN (SELECT id FROM _del_so)
    AND "paidAt" < (SELECT start_at FROM _cut);
  IF bad > 0 THEN
    RAISE EXCEPTION 'BATAL: ada % pembayaran awal sebelum 17 Okt pada SalesOrder yang akan dihapus.', bad;
  END IF;

  SELECT count(*) INTO bad
  FROM "PurchaseOrderDeposit"
  WHERE "purchaseOrderId" IN (SELECT id FROM _del_po)
    AND "paidAt" < (SELECT start_at FROM _cut);
  IF bad > 0 THEN
    RAISE EXCEPTION 'BATAL: ada % deposit PO sebelum 17 Okt pada PO yang akan dihapus.', bad;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. DELETE: anak dulu, induk terakhir (semua FK Restrict)
-- ----------------------------------------------------------------------------
-- 4a. WhatsApp & pengingat
DELETE FROM "WhatsAppMessage" WHERE id IN (SELECT id FROM _del_msg);
DELETE FROM "WhatsAppAutomationJob" WHERE id IN (SELECT id FROM _del_job);
DELETE FROM "WhatsAppCampaignRecipient"
WHERE "campaignId" IN (SELECT id FROM _del_campaign)
   OR "customerId" IN (SELECT id FROM _del_customer);
DELETE FROM "WhatsAppCampaign" WHERE id IN (SELECT id FROM _del_campaign);
DELETE FROM "WhatsAppConversation" WHERE id IN (SELECT id FROM _del_convo);

DELETE FROM "CustomerReminderReceipt" WHERE "reminderId" IN (SELECT id FROM _del_reminder);
DELETE FROM "CustomerReminder" WHERE id IN (SELECT id FROM _del_reminder);

-- 4b. Komunikasi (referensi Restrict ke Opportunity/Customer/AuditEvent)
DELETE FROM "CommunicationActivity" WHERE id IN (SELECT id FROM _del_comm);

-- 4c. Pembayaran (transaksi -> termin -> pembayaran induk)
DELETE FROM "PaymentTransaction"
WHERE "paymentId" IN (SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so));
DELETE FROM "PaymentTerm"
WHERE "paymentId" IN (SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so));
DELETE FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM _del_so);

DELETE FROM "PendingPaymentTerm"
WHERE "pendingPaymentId" IN (SELECT id FROM "PendingDealPayment" WHERE "invoiceId" IN (SELECT id FROM _del_inv));
DELETE FROM "PendingDealPayment" WHERE "invoiceId" IN (SELECT id FROM _del_inv);

-- 4d. Keuangan (hanya spentAt dalam rentang; Agustus tetap)
DELETE FROM "Expense" WHERE id IN (SELECT id FROM _del_expense);

-- 4e. Produksi (activity -> step -> work order)
DELETE FROM "ProductionActivity" WHERE "workOrderId" IN (SELECT id FROM _del_wo);
DELETE FROM "ProductionStep" WHERE "workOrderId" IN (SELECT id FROM _del_wo);
DELETE FROM "ProductionWorkOrder" WHERE id IN (SELECT id FROM _del_wo);

-- 4f. Sales Order
DELETE FROM "SalesOrderCost" WHERE "salesOrderId" IN (SELECT id FROM _del_so);
DELETE FROM "SalesOrderItem" WHERE "salesOrderId" IN (SELECT id FROM _del_so);
DELETE FROM "SalesOrder" WHERE id IN (SELECT id FROM _del_so);

-- 4g. Invoice
DELETE FROM "InvoiceItemAddon"
WHERE "invoiceItemId" IN (SELECT id FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM _del_inv));
DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM _del_inv);
DELETE FROM "Invoice" WHERE id IN (SELECT id FROM _del_inv);

-- 4h. Desain
DELETE FROM "DesignAttachment"
WHERE "designRevisionId" IN (
  SELECT r.id FROM "DesignRevision" r
  JOIN "DesignTask" t ON t.id = r."designTaskId"
  WHERE t."purchaseOrderId" IN (SELECT id FROM _del_po)
);
DELETE FROM "DesignRevision"
WHERE "designTaskId" IN (SELECT id FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po));
DELETE FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);

-- 4i. Purchase Order
DELETE FROM "PurchaseOrderDeposit" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);
DELETE FROM "PurchaseOrderAttachment" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);
DELETE FROM "PurchaseOrderSize" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);
DELETE FROM "PurchaseOrderRosterEntry" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);
DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM _del_po);
DELETE FROM "PurchaseOrder" WHERE id IN (SELECT id FROM _del_po);

-- 4j. Pipeline & customer baru
DELETE FROM "Opportunity" WHERE id IN (SELECT id FROM _del_opp);
DELETE FROM "Customer" WHERE id IN (SELECT id FROM _del_customer);

-- 4k. Absensi, audit, rate limit
DELETE FROM "Attendance" WHERE id IN (SELECT id FROM _del_attendance);
DELETE FROM "AuditEvent" ae
WHERE ae."createdAt" >= (SELECT start_at FROM _cut)
  AND ae."createdAt" <  (SELECT end_at FROM _cut)
  AND NOT EXISTS (
    SELECT 1 FROM "CommunicationActivity" ca WHERE ca."sourceAuditEventId" = ae.id
  );
DELETE FROM "PublicRateLimitBucket"
WHERE "updatedAt" >= (SELECT start_at FROM _cut)
  AND "updatedAt" <  (SELECT end_at FROM _cut);

-- ----------------------------------------------------------------------------
-- 5. RESET PENOMORAN (pola v1) + pengaman: counter dengan baris lama JANGAN
--    direset agar nomor dokumen tidak duplikat.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  has_old boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM "Opportunity" WHERE "createdAt" < (SELECT start_at FROM _cut)) INTO has_old;
  IF has_old THEN
    RAISE NOTICE 'Counter opportunity dipertahankan: masih ada data lama.';
  ELSE
    DELETE FROM "SequenceCounter" WHERE key = 'opportunity';
  END IF;

  SELECT EXISTS (SELECT 1 FROM "Invoice" WHERE "createdAt" < (SELECT start_at FROM _cut)) INTO has_old;
  IF has_old THEN
    RAISE NOTICE 'Counter invoice dipertahankan: masih ada data lama.';
  ELSE
    DELETE FROM "SequenceCounter" WHERE key LIKE 'invoice:%';
  END IF;

  SELECT EXISTS (SELECT 1 FROM "SalesOrder" WHERE "createdAt" < (SELECT start_at FROM _cut)) INTO has_old;
  IF has_old THEN
    RAISE NOTICE 'Counter sales-order dipertahankan: masih ada data lama.';
  ELSE
    DELETE FROM "SequenceCounter" WHERE key LIKE 'sales-order:%';
  END IF;

  SELECT EXISTS (SELECT 1 FROM "ProductionWorkOrder" WHERE "createdAt" < (SELECT start_at FROM _cut)) INTO has_old;
  IF has_old THEN
    RAISE NOTICE 'Counter work-order dipertahankan: masih ada data lama.';
  ELSE
    DELETE FROM "SequenceCounter" WHERE key LIKE 'work-order:%';
  END IF;

  -- Counter PO milik customer yang dihapus ikut dibersihkan.
  DELETE FROM "SequenceCounter"
  WHERE key LIKE 'purchase-order:%'
    AND split_part(key, ':', 2) IN (SELECT id FROM _del_customer);

  -- Counter customer SELALU dipertahankan (customer lama hasil impor tetap ada).
END $$;

-- ----------------------------------------------------------------------------
-- 6. VERIFIKASI: master & keuangan lama tidak boleh berubah
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  after_c bigint;
BEGIN
  FOR r IN SELECT tbl, c FROM _guard_master LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.tbl) INTO after_c;
    IF after_c IS DISTINCT FROM r.c THEN
      RAISE EXCEPTION 'PENJAGA GAGAL: % berubah % -> % (rollback!)', r.tbl, r.c, after_c;
    END IF;
  END LOOP;

  FOR r IN SELECT tbl, c FROM _guard_finance LOOP
    CASE r.tbl
      WHEN 'Expense:spentAt<start' THEN
        SELECT count(*) INTO after_c FROM "Expense" WHERE "spentAt" < (SELECT start_date FROM _cut);
      WHEN 'DealPayment:paidAt<start' THEN
        SELECT count(*) INTO after_c FROM "DealPayment" WHERE "paidAt" < (SELECT start_at FROM _cut);
      WHEN 'PaymentTransaction:paidAt<start' THEN
        SELECT count(*) INTO after_c FROM "PaymentTransaction" WHERE "paidAt" < (SELECT start_at FROM _cut);
      WHEN 'PurchaseOrderDeposit:paidAt<start' THEN
        SELECT count(*) INTO after_c FROM "PurchaseOrderDeposit" WHERE "paidAt" < (SELECT start_at FROM _cut);
      WHEN 'Customer:createdAt<start' THEN
        SELECT count(*) INTO after_c FROM "Customer" WHERE "createdAt" < (SELECT start_at FROM _cut);
    END CASE;
    IF after_c IS DISTINCT FROM r.c THEN
      RAISE EXCEPTION 'PENJAGA KEUANGAN GAGAL: % berubah % -> % (rollback!)', r.tbl, r.c, after_c;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. RINGKASAN SESUDAH
-- ----------------------------------------------------------------------------
SELECT 'SESUDAH' AS fase, 'Customer' AS tbl, count(*) AS c FROM "Customer"
UNION ALL SELECT 'SESUDAH', 'Opportunity', count(*) FROM "Opportunity"
UNION ALL SELECT 'SESUDAH', 'PurchaseOrder', count(*) FROM "PurchaseOrder"
UNION ALL SELECT 'SESUDAH', 'Invoice', count(*) FROM "Invoice"
UNION ALL SELECT 'SESUDAH', 'SalesOrder', count(*) FROM "SalesOrder"
UNION ALL SELECT 'SESUDAH', 'ProductionWorkOrder', count(*) FROM "ProductionWorkOrder"
UNION ALL SELECT 'SESUDAH', 'CustomerReminder', count(*) FROM "CustomerReminder"
UNION ALL SELECT 'SESUDAH', 'WhatsAppCampaign', count(*) FROM "WhatsAppCampaign"
UNION ALL SELECT 'SESUDAH', 'WhatsAppAutomationJob', count(*) FROM "WhatsAppAutomationJob"
UNION ALL SELECT 'SESUDAH', 'WhatsAppConversation', count(*) FROM "WhatsAppConversation"
UNION ALL SELECT 'SESUDAH', 'WhatsAppMessage', count(*) FROM "WhatsAppMessage"
UNION ALL SELECT 'SESUDAH', 'Expense (total)', count(*) FROM "Expense"
UNION ALL SELECT 'SESUDAH', 'Expense Agustus (< 17 Okt)', count(*) FROM "Expense"
  WHERE "spentAt" < (SELECT start_date FROM _cut)
UNION ALL SELECT 'SESUDAH', 'Attendance', count(*) FROM "Attendance"
UNION ALL SELECT 'SESUDAH', 'AppUser (harus > 0)', count(*) FROM "AppUser"
UNION ALL SELECT 'SESUDAH', 'BusinessProfile (harus > 0)', count(*) FROM "BusinessProfile"
ORDER BY tbl;

COMMIT;

-- ============================================================
-- SETELAH COMMIT — hapus file Storage yang sudah tercatat di langkah 2.
-- Bucket: crm-po-designs, payment-proofs, whatsapp-media.
-- Gunakan Supabase Dashboard > Storage atau Storage API (remove).
-- Menghapus baris storage.objects lewat SQL TIDAK menghapus file fisik.
-- ============================================================
