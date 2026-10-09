-- ============================================================================
-- CLEANUP DATA TRANSAKSIONAL + DEMO (Askonveksi)
-- ============================================================================
-- TUJUAN:
--  1. Hapus SEMUA order & turunannya: PurchaseOrder (+size/roster/attachment),
--     Invoice (+item), SalesOrder (+item/cost), ProductionWorkOrder (+step/
--     activity), DealPayment (+term/transaction), PendingDealPayment (+term)
--  2. Hapus SEMUA keuangan: Expense (+ DealPayment chain di atas)
--  3. Hapus 20 CUSTOMER DEMO saja (by customerNo eksplisit), customer asli aman
--  4. JANGAN hapus master: CustomerType, LeadSource, GarmentSize,
--     PaymentMethod, ProductCategory
--  5. Hapus SEMUA desain: DesignTask -> DesignRevision -> DesignAttachment
--  6. Hapus SEMUA kampanye: WhatsAppCampaign (+recipient, cascade) + semua
--     WhatsAppAutomationJob
--  7. Hapus SEMUA template: WhatsAppTemplate
--  8+9. Hapus SEMUA prospek & pipeline: Opportunity (semua stage) +
--     CommunicationActivity yang menempel ke opportunity/customer demo +
--     CustomerReminder (+receipt)
-- 10. JANGAN hapus data perusahaan: BusinessProfile, AppUser, SequenceCounter
--     (nomor CUS-/PO-/INV-/SO-/WO- tetap lanjut, tidak dipakai ulang)
--
-- YANG SENGAJA TIDAK DIHAPUS (tetap ada, aman):
--  AuditEvent (log audit), PublicRateLimitBucket, WhatsAppAccount,
--  WhatsAppConversation, WhatsAppMessage (riwayat chat), SequenceCounter.
--
-- CARA PAKAI:
--  1. Review daftar DEMO_CUSTOMER_NOS di bawah, sesuaikan bila perlu.
--  2. Jalankan SEKALIGUS di database yang dituju (Supabase SQL Editor / psql):
--       psql "$DIRECT_URL" -f scripts/cleanup-transactional-data.sql
--  3. Script ini SATU TRANSAKSI: guard akan ROLLBACK otomatis bila data
--     master/perusahaan/customer-asli berubah (lihat PENJAGA di bawah).
--  4. File fisik di Storage bucket TIDAK ikut terhapus (baris DB-nya saja).
--     Bersihkan manual via dashboard bila perlu.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. DAFTAR CUSTOMER DEMO YANG BOLEH DIHAPUS (satu-satunya filter customer)
-- ----------------------------------------------------------------------------
-- Ditulis eksplisit agar customer asli tidak mungkin ikut terhapus.
CREATE TEMP TABLE _demo_customer_nos ("customerNo" TEXT PRIMARY KEY);
INSERT INTO _demo_customer_nos ("customerNo") VALUES
  ('DEMO-CUS-PRODUCTION'),
  ('CUS-000001'), ('CUS-000002'), ('CUS-000003'),
  ('CUS-000004'), ('CUS-000005'), ('CUS-000006'), ('CUS-000007'),
  ('CUS-000008'), ('CUS-000009'), ('CUS-000010'), ('CUS-000011'),
  ('CUS-000012'), ('CUS-000013'), ('CUS-000014'), ('CUS-000015'),
  ('CUS-000016'), ('CUS-000017'), ('CUS-000018'), ('CUS-000019');

-- ----------------------------------------------------------------------------
-- PENJAGA: snapshot data yang WAJIB utuh (master + perusahaan + lain-lain)
-- Bila ada yang berubah sampai akhir transaksi -> ROLLBACK + error.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _guard_before AS
SELECT 'CustomerType'            AS tbl, count(*) AS c FROM "CustomerType"
UNION ALL SELECT 'LeadSource',          count(*) FROM "LeadSource"
UNION ALL SELECT 'GarmentSize',         count(*) FROM "GarmentSize"
UNION ALL SELECT 'PaymentMethod',       count(*) FROM "PaymentMethod"
UNION ALL SELECT 'ProductCategory',     count(*) FROM "ProductCategory"
UNION ALL SELECT 'BusinessProfile',     count(*) FROM "BusinessProfile"
UNION ALL SELECT 'AppUser',             count(*) FROM "AppUser"
UNION ALL SELECT 'SequenceCounter',     count(*) FROM "SequenceCounter"
UNION ALL SELECT 'AuditEvent',          count(*) FROM "AuditEvent"
UNION ALL SELECT 'PublicRateLimitBucket', count(*) FROM "PublicRateLimitBucket"
UNION ALL SELECT 'WhatsAppAccount',     count(*) FROM "WhatsAppAccount"
UNION ALL SELECT 'WhatsAppConversation', count(*) FROM "WhatsAppConversation"
UNION ALL SELECT 'WhatsAppMessage',     count(*) FROM "WhatsAppMessage"
-- customer ASLI (di luar daftar demo) wajib utuh:
UNION ALL SELECT 'Customer:asli', count(*) FROM "Customer"
  WHERE "customerNo" NOT IN (SELECT "customerNo" FROM _demo_customer_nos);

-- Ringkasan SEBELUM (bandingkan dengan hasil akhir di bawah):
SELECT 'SEBELUM' AS fase, tbl, c FROM _guard_before ORDER BY tbl;

-- ----------------------------------------------------------------------------
-- 1. PENGINGAT + RECEIPT (menggantung ke Customer & SalesOrder)
-- ----------------------------------------------------------------------------
DELETE FROM "CustomerReminderReceipt";
DELETE FROM "WhatsAppAutomationJob";
DELETE FROM "CustomerReminder";

-- ----------------------------------------------------------------------------
-- 2. KAMPANYE (recipient ikut terhapus via CASCADE) + TEMPLATE WA
-- ----------------------------------------------------------------------------
DELETE FROM "WhatsAppCampaign";
-- Catatan: "WhatsAppCampaignRecipient" ikut terhapus otomatis (CASCADE).
DELETE FROM "WhatsAppTemplate";

-- ----------------------------------------------------------------------------
-- 3. RIWAYAT KOMUNIKASI yang menempel ke pipeline/customer demo.
--     Riwayat milik customer ASLI (tanpa opportunity) DIPERTAHANKAN.
-- ----------------------------------------------------------------------------
DELETE FROM "CommunicationActivity"
WHERE "opportunityId" IS NOT NULL
   OR "customerId" IN (
     SELECT id FROM "Customer"
     WHERE "customerNo" IN (SELECT "customerNo" FROM _demo_customer_nos)
   );

-- ----------------------------------------------------------------------------
-- 4. PEMBAYARAN DEAL (transaksi -> termin -> pembayaran induk)
-- ----------------------------------------------------------------------------
DELETE FROM "PaymentTransaction";
DELETE FROM "PaymentTerm";
DELETE FROM "DealPayment";

-- ----------------------------------------------------------------------------
-- 5. PEMBAYARAN PENDING (termin -> pembayaran induk, menempel ke Invoice)
-- ----------------------------------------------------------------------------
DELETE FROM "PendingPaymentTerm";
DELETE FROM "PendingDealPayment";

-- ----------------------------------------------------------------------------
-- 6. KEUANGAN: pengeluaran
-- ----------------------------------------------------------------------------
DELETE FROM "Expense";

-- ----------------------------------------------------------------------------
-- 7. PRODUKSI (aktivitas -> step -> work order)
-- ----------------------------------------------------------------------------
DELETE FROM "ProductionActivity";
DELETE FROM "ProductionStep";
DELETE FROM "ProductionWorkOrder";

-- ----------------------------------------------------------------------------
-- 8. SALES ORDER (cost + item -> sales order induk)
-- ----------------------------------------------------------------------------
DELETE FROM "SalesOrderCost";
DELETE FROM "SalesOrderItem";
DELETE FROM "SalesOrder";

-- ----------------------------------------------------------------------------
-- 9. INVOICE (item -> invoice induk)
-- ----------------------------------------------------------------------------
DELETE FROM "InvoiceItem";
DELETE FROM "Invoice";

-- ----------------------------------------------------------------------------
-- 10. DESAIN (attachment -> revisi -> task induk, menempel ke PO)
-- ----------------------------------------------------------------------------
DELETE FROM "DesignAttachment";
DELETE FROM "DesignRevision";
DELETE FROM "DesignTask";

-- ----------------------------------------------------------------------------
-- 11. PURCHASE ORDER (size + roster + attachment -> PO induk)
-- ----------------------------------------------------------------------------
DELETE FROM "PurchaseOrderSize";
DELETE FROM "PurchaseOrderRosterEntry";
DELETE FROM "PurchaseOrderAttachment";
DELETE FROM "PurchaseOrder";

-- ----------------------------------------------------------------------------
-- 12. PIPELINE / PROSPEK: hapus SEMUA opportunity (semua stage)
-- ----------------------------------------------------------------------------
DELETE FROM "Opportunity";

-- ----------------------------------------------------------------------------
-- 13. CUSTOMER DEMO SAJA (customer asli tidak tersentuh)
-- ----------------------------------------------------------------------------
DELETE FROM "Customer"
WHERE "customerNo" IN (SELECT "customerNo" FROM _demo_customer_nos);

-- ----------------------------------------------------------------------------
-- PENJAGA: verifikasi akhir. Rollback bila ada data wajib yang berubah.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  after_c BIGINT;
BEGIN
  FOR r IN SELECT tbl, c AS before_c FROM _guard_before LOOP
    CASE r.tbl
      WHEN 'CustomerType' THEN SELECT count(*) INTO after_c FROM "CustomerType";
      WHEN 'LeadSource' THEN SELECT count(*) INTO after_c FROM "LeadSource";
      WHEN 'GarmentSize' THEN SELECT count(*) INTO after_c FROM "GarmentSize";
      WHEN 'PaymentMethod' THEN SELECT count(*) INTO after_c FROM "PaymentMethod";
      WHEN 'ProductCategory' THEN SELECT count(*) INTO after_c FROM "ProductCategory";
      WHEN 'BusinessProfile' THEN SELECT count(*) INTO after_c FROM "BusinessProfile";
      WHEN 'AppUser' THEN SELECT count(*) INTO after_c FROM "AppUser";
      WHEN 'SequenceCounter' THEN SELECT count(*) INTO after_c FROM "SequenceCounter";
      WHEN 'AuditEvent' THEN SELECT count(*) INTO after_c FROM "AuditEvent";
      WHEN 'PublicRateLimitBucket' THEN SELECT count(*) INTO after_c FROM "PublicRateLimitBucket";
      WHEN 'WhatsAppAccount' THEN SELECT count(*) INTO after_c FROM "WhatsAppAccount";
      WHEN 'WhatsAppConversation' THEN SELECT count(*) INTO after_c FROM "WhatsAppConversation";
      WHEN 'WhatsAppMessage' THEN SELECT count(*) INTO after_c FROM "WhatsAppMessage";
      WHEN 'Customer:asli' THEN SELECT count(*) INTO after_c FROM "Customer"
        WHERE "customerNo" NOT IN (SELECT "customerNo" FROM _demo_customer_nos);
    END CASE;
    IF after_c IS DISTINCT FROM r.before_c THEN
      RAISE EXCEPTION 'PENJAGA GAGAL: % berubah % -> % (rollback!)',
        r.tbl, r.before_c, after_c;
    END IF;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- RINGKASAN SESUDAH (harus: order/desain/kampanye/template/prospek = 0,
-- customer tersisa = customer asli saja)
-- ----------------------------------------------------------------------------
SELECT 'SESUDAH' AS fase, 'PurchaseOrder' AS tbl, count(*) AS c FROM "PurchaseOrder"
UNION ALL SELECT 'SESUDAH', 'PurchaseOrderSize', count(*) FROM "PurchaseOrderSize"
UNION ALL SELECT 'SESUDAH', 'PurchaseOrderRosterEntry', count(*) FROM "PurchaseOrderRosterEntry"
UNION ALL SELECT 'SESUDAH', 'PurchaseOrderAttachment', count(*) FROM "PurchaseOrderAttachment"
UNION ALL SELECT 'SESUDAH', 'Invoice', count(*) FROM "Invoice"
UNION ALL SELECT 'SESUDAH', 'InvoiceItem', count(*) FROM "InvoiceItem"
UNION ALL SELECT 'SESUDAH', 'SalesOrder', count(*) FROM "SalesOrder"
UNION ALL SELECT 'SESUDAH', 'SalesOrderItem', count(*) FROM "SalesOrderItem"
UNION ALL SELECT 'SESUDAH', 'SalesOrderCost', count(*) FROM "SalesOrderCost"
UNION ALL SELECT 'SESUDAH', 'ProductionWorkOrder', count(*) FROM "ProductionWorkOrder"
UNION ALL SELECT 'SESUDAH', 'ProductionStep', count(*) FROM "ProductionStep"
UNION ALL SELECT 'SESUDAH', 'ProductionActivity', count(*) FROM "ProductionActivity"
UNION ALL SELECT 'SESUDAH', 'DealPayment', count(*) FROM "DealPayment"
UNION ALL SELECT 'SESUDAH', 'PaymentTerm', count(*) FROM "PaymentTerm"
UNION ALL SELECT 'SESUDAH', 'PaymentTransaction', count(*) FROM "PaymentTransaction"
UNION ALL SELECT 'SESUDAH', 'PendingDealPayment', count(*) FROM "PendingDealPayment"
UNION ALL SELECT 'SESUDAH', 'PendingPaymentTerm', count(*) FROM "PendingPaymentTerm"
UNION ALL SELECT 'SESUDAH', 'Expense', count(*) FROM "Expense"
UNION ALL SELECT 'SESUDAH', 'DesignTask', count(*) FROM "DesignTask"
UNION ALL SELECT 'SESUDAH', 'DesignRevision', count(*) FROM "DesignRevision"
UNION ALL SELECT 'SESUDAH', 'DesignAttachment', count(*) FROM "DesignAttachment"
UNION ALL SELECT 'SESUDAH', 'Opportunity', count(*) FROM "Opportunity"
UNION ALL SELECT 'SESUDAH', 'CommunicationActivity', count(*) FROM "CommunicationActivity"
UNION ALL SELECT 'SESUDAH', 'CustomerReminder', count(*) FROM "CustomerReminder"
UNION ALL SELECT 'SESUDAH', 'CustomerReminderReceipt', count(*) FROM "CustomerReminderReceipt"
UNION ALL SELECT 'SESUDAH', 'WhatsAppCampaign', count(*) FROM "WhatsAppCampaign"
UNION ALL SELECT 'SESUDAH', 'WhatsAppCampaignRecipient', count(*) FROM "WhatsAppCampaignRecipient"
UNION ALL SELECT 'SESUDAH', 'WhatsAppAutomationJob', count(*) FROM "WhatsAppAutomationJob"
UNION ALL SELECT 'SESUDAH', 'WhatsAppTemplate', count(*) FROM "WhatsAppTemplate"
UNION ALL SELECT 'SESUDAH', 'Customer:sisa', count(*) FROM "Customer"
ORDER BY tbl;

COMMIT;
