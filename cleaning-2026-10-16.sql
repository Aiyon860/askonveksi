-- ============================================================
-- CLEANING DATA >= 9 Okt 2026 (zona Asia/Jakarta)
-- Dibuat: 16 Okt 2026. Dijalankan manual via Supabase SQL Editor.
-- DIKECUALIKAN (tidak disentuh): BusinessProfile, AppUser,
-- CustomerType, LeadSource, GarmentSize, PaymentMethod,
-- ProductCategory, InvoiceSettingPoint, WhatsAppTemplate,
-- WhatsAppAccount
-- CATATAN: file di Supabase Storage TIDAK ikut terhapus.
-- ============================================================
BEGIN;

-- 0) PENGAMAN: reset sequence hanya aman bila tidak ada baris lama tersisa
DO $$
DECLARE
  sisa int;
BEGIN
  SELECT count(*) INTO sisa FROM (
    SELECT 1 FROM "Customer" WHERE "createdAt" < '2026-10-09 00:00:00+07'
    UNION ALL SELECT 1 FROM "Opportunity" WHERE "createdAt" < '2026-10-09 00:00:00+07'
    UNION ALL SELECT 1 FROM "PurchaseOrder" WHERE "createdAt" < '2026-10-09 00:00:00+07'
    UNION ALL SELECT 1 FROM "Invoice" WHERE "createdAt" < '2026-10-09 00:00:00+07'
    UNION ALL SELECT 1 FROM "SalesOrder" WHERE "createdAt" < '2026-10-09 00:00:00+07'
    UNION ALL SELECT 1 FROM "ProductionWorkOrder" WHERE "createdAt" < '2026-10-09 00:00:00+07'
  ) t;
  IF sisa > 0 THEN
    RAISE EXCEPTION 'BATAL: ada % baris LAMA (< 9 Okt 2026). Reset sequence akan merusak penomoran. Putuskan: hapus total atau jangan reset.', sisa;
  END IF;
  RAISE NOTICE 'Pengaman lolos: tidak ada baris lama di tabel bernomor.';
END $$;

-- 1) Kumpulkan id yang akan dihapus
CREATE TEMP TABLE del_customer AS SELECT id FROM "Customer" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_opp      AS SELECT id FROM "Opportunity" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_po       AS SELECT id FROM "PurchaseOrder" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_inv      AS SELECT id FROM "Invoice" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_so       AS SELECT id FROM "SalesOrder" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_wo       AS SELECT id FROM "ProductionWorkOrder" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_reminder AS SELECT id FROM "CustomerReminder" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_convo    AS SELECT id FROM "WhatsAppConversation" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_job      AS SELECT id FROM "WhatsAppAutomationJob" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
CREATE TEMP TABLE del_campaign AS SELECT id FROM "WhatsAppCampaign" WHERE "createdAt" >= '2026-10-09 00:00:00+07';

-- 2) Anak-anak WhatsApp & reminder (FK Restrict ke parent)
DELETE FROM "WhatsAppMessage" WHERE "conversationId" IN (SELECT id FROM del_convo)
  OR "automationJobId" IN (SELECT id FROM del_job) OR "createdAt" >= '2026-10-09 00:00:00+07';
DELETE FROM "WhatsAppAutomationJob" WHERE id IN (SELECT id FROM del_job);
DELETE FROM "WhatsAppCampaignRecipient" WHERE "campaignId" IN (SELECT id FROM del_campaign);
DELETE FROM "WhatsAppCampaign" WHERE id IN (SELECT id FROM del_campaign);
DELETE FROM "CustomerReminderReceipt" WHERE "reminderId" IN (SELECT id FROM del_reminder);
DELETE FROM "CustomerReminder" WHERE id IN (SELECT id FROM del_reminder);
DELETE FROM "CommunicationActivity" WHERE "createdAt" >= '2026-10-09 00:00:00+07';

-- 3) Rantai pembayaran & order (anak dulu)
DELETE FROM "PaymentTransaction" WHERE "paymentId" IN (SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM del_so));
DELETE FROM "PaymentTerm" WHERE "paymentId" IN (SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM del_so));
DELETE FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM del_so);
DELETE FROM "Expense" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
DELETE FROM "SalesOrderCost" WHERE "salesOrderId" IN (SELECT id FROM del_so);
DELETE FROM "SalesOrderItem" WHERE "salesOrderId" IN (SELECT id FROM del_so);
DELETE FROM "ProductionStep" WHERE "workOrderId" IN (SELECT id FROM del_wo);
DELETE FROM "ProductionActivity" WHERE "workOrderId" IN (SELECT id FROM del_wo);
DELETE FROM "PendingPaymentTerm" WHERE "pendingPaymentId" IN (SELECT id FROM "PendingDealPayment" WHERE "invoiceId" IN (SELECT id FROM del_inv));
DELETE FROM "PendingDealPayment" WHERE "invoiceId" IN (SELECT id FROM del_inv);
DELETE FROM "InvoiceItemAddon" WHERE "invoiceItemId" IN (SELECT id FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM del_inv));
DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM del_inv);

-- 4) Anak-anak PO (desain, ukuran, roster, lampiran, deposit)
DELETE FROM "DesignAttachment" WHERE "designRevisionId" IN (SELECT r.id FROM "DesignRevision" r JOIN "DesignTask" t ON t.id = r."designTaskId" WHERE t."purchaseOrderId" IN (SELECT id FROM del_po));
DELETE FROM "DesignRevision" WHERE "designTaskId" IN (SELECT id FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM del_po));
DELETE FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);
DELETE FROM "PurchaseOrderDeposit" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);
DELETE FROM "PurchaseOrderAttachment" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);
DELETE FROM "PurchaseOrderSize" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);
DELETE FROM "PurchaseOrderRosterEntry" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);
DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM del_po);

-- 5) Parent berurutan (yang direferensikan terakhir)
DELETE FROM "ProductionWorkOrder" WHERE id IN (SELECT id FROM del_wo);
DELETE FROM "SalesOrder" WHERE id IN (SELECT id FROM del_so);
DELETE FROM "Invoice" WHERE id IN (SELECT id FROM del_inv);
DELETE FROM "PurchaseOrder" WHERE id IN (SELECT id FROM del_po);
DELETE FROM "Opportunity" WHERE id IN (SELECT id FROM del_opp);
DELETE FROM "AuditEvent" WHERE "createdAt" >= '2026-10-09 00:00:00+07';
DELETE FROM "Customer" WHERE id IN (SELECT id FROM del_customer);
DELETE FROM "PublicRateLimitBucket" WHERE "updatedAt" >= '2026-10-09 00:00:00+07';

-- 6) Reset penomoran (aman: pengaman di langkah 0 lolos)
TRUNCATE "SequenceCounter";

-- 7) Verifikasi sisa
SELECT 'Customer' t, count(*) FROM "Customer" UNION ALL
SELECT 'Opportunity', count(*) FROM "Opportunity" UNION ALL
SELECT 'PurchaseOrder', count(*) FROM "PurchaseOrder" UNION ALL
SELECT 'Invoice', count(*) FROM "Invoice" UNION ALL
SELECT 'SalesOrder', count(*) FROM "SalesOrder" UNION ALL
SELECT 'ProductionWorkOrder', count(*) FROM "ProductionWorkOrder" UNION ALL
SELECT 'AppUser (harus > 0)', count(*) FROM "AppUser" UNION ALL
SELECT 'BusinessProfile (harus > 0)', count(*) FROM "BusinessProfile";

COMMIT;
