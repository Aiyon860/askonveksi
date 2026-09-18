-- Keep only draft invoice work. Issued document chains are intentionally removed.
CREATE TABLE "_cleanup_opportunity" AS
SELECT DISTINCT "opportunityId" AS id FROM "Invoice" WHERE status = 'ISSUED';

CREATE TABLE "_cleanup_purchase_order" AS
SELECT id FROM "PurchaseOrder" WHERE "opportunityId" IN (SELECT id FROM "_cleanup_opportunity");

CREATE TABLE "_cleanup_invoice" AS
SELECT id FROM "Invoice"
WHERE "opportunityId" IN (SELECT id FROM "_cleanup_opportunity") OR status = 'SUPERSEDED';

CREATE TABLE "_cleanup_sales_order" AS
SELECT id FROM "SalesOrder" WHERE "opportunityId" IN (SELECT id FROM "_cleanup_opportunity");

CREATE TABLE "_cleanup_payment" AS
SELECT id FROM "DealPayment" WHERE "salesOrderId" IN (SELECT id FROM "_cleanup_sales_order");

CREATE TABLE "_cleanup_pending_payment" AS
SELECT id FROM "PendingDealPayment" WHERE "invoiceId" IN (SELECT id FROM "_cleanup_invoice");

CREATE TABLE "_cleanup_work_order" AS
SELECT id FROM "ProductionWorkOrder" WHERE "salesOrderId" IN (SELECT id FROM "_cleanup_sales_order");

CREATE TABLE "_cleanup_reminder" AS
SELECT id FROM "CustomerReminder" WHERE "sourceSalesOrderId" IN (SELECT id FROM "_cleanup_sales_order");

CREATE TABLE "_cleanup_whatsapp_job" AS
SELECT id FROM "WhatsAppAutomationJob"
WHERE "opportunityId" IN (SELECT id FROM "_cleanup_opportunity")
   OR "invoiceId" IN (SELECT id FROM "_cleanup_invoice")
   OR "reminderId" IN (SELECT id FROM "_cleanup_reminder");

DELETE FROM "CommunicationActivity" WHERE "opportunityId" IN (SELECT id FROM "_cleanup_opportunity");
DELETE FROM "WhatsAppMessage" WHERE "automationJobId" IN (SELECT id FROM "_cleanup_whatsapp_job");
DELETE FROM "WhatsAppAutomationJob" WHERE id IN (SELECT id FROM "_cleanup_whatsapp_job");
DELETE FROM "CustomerReminderReceipt" WHERE "reminderId" IN (SELECT id FROM "_cleanup_reminder");
DELETE FROM "CustomerReminder" WHERE id IN (SELECT id FROM "_cleanup_reminder");
DELETE FROM "ProductionActivity" WHERE "workOrderId" IN (SELECT id FROM "_cleanup_work_order");
DELETE FROM "ProductionStep" WHERE "workOrderId" IN (SELECT id FROM "_cleanup_work_order");
DELETE FROM "ProductionWorkOrder" WHERE id IN (SELECT id FROM "_cleanup_work_order");
DELETE FROM "PaymentTransaction" WHERE "paymentId" IN (SELECT id FROM "_cleanup_payment");
DELETE FROM "PaymentTerm" WHERE "paymentId" IN (SELECT id FROM "_cleanup_payment");
DELETE FROM "DealPayment" WHERE id IN (SELECT id FROM "_cleanup_payment");
DELETE FROM "PendingPaymentTerm" WHERE "pendingPaymentId" IN (SELECT id FROM "_cleanup_pending_payment");
DELETE FROM "PendingDealPayment" WHERE id IN (SELECT id FROM "_cleanup_pending_payment");
DELETE FROM "SalesOrderItem" WHERE "salesOrderId" IN (SELECT id FROM "_cleanup_sales_order");
DELETE FROM "SalesOrder" WHERE id IN (SELECT id FROM "_cleanup_sales_order");
DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM "_cleanup_invoice");
DELETE FROM "Invoice" WHERE id IN (SELECT id FROM "_cleanup_invoice");
DELETE FROM "DesignAttachment" WHERE "designRevisionId" IN (
  SELECT revision.id FROM "DesignRevision" revision
  INNER JOIN "DesignTask" task ON task.id = revision."designTaskId"
  WHERE task."purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order")
);
DELETE FROM "DesignRevision" WHERE "designTaskId" IN (
  SELECT id FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order")
);
DELETE FROM "DesignTask" WHERE "purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order");
DELETE FROM "PurchaseOrderAttachment" WHERE "purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order");
DELETE FROM "PurchaseOrderRosterEntry" WHERE "purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order");
DELETE FROM "PurchaseOrderSize" WHERE "purchaseOrderId" IN (SELECT id FROM "_cleanup_purchase_order");
DELETE FROM "PurchaseOrder" WHERE id IN (SELECT id FROM "_cleanup_purchase_order");
DELETE FROM "AuditEvent"
WHERE ("entityType" = 'Opportunity' AND "entityId" IN (SELECT id FROM "_cleanup_opportunity"))
   OR ("entityType" = 'PurchaseOrder' AND "entityId" IN (SELECT id FROM "_cleanup_purchase_order"))
   OR ("entityType" = 'Invoice' AND "entityId" IN (SELECT id FROM "_cleanup_invoice"))
   OR ("entityType" = 'SalesOrder' AND "entityId" IN (SELECT id FROM "_cleanup_sales_order"))
   OR ("entityType" IN ('DealPayment', 'PaymentTerm', 'PaymentTransaction') AND "entityId" IN (SELECT id FROM "_cleanup_payment"));
DELETE FROM "Opportunity" WHERE id IN (SELECT id FROM "_cleanup_opportunity");
DROP TABLE "_cleanup_whatsapp_job", "_cleanup_reminder", "_cleanup_work_order", "_cleanup_pending_payment", "_cleanup_payment", "_cleanup_sales_order", "_cleanup_invoice", "_cleanup_purchase_order", "_cleanup_opportunity";

ALTER TABLE "Invoice" RENAME COLUMN "totalTax" TO "totalProfit";
ALTER TABLE "InvoiceItem" RENAME COLUMN "taxRate" TO "profitPercent";
ALTER TABLE "InvoiceItem" RENAME COLUMN "taxAmount" TO "profitAmount";
ALTER TABLE "SalesOrderItem" RENAME COLUMN "taxRate" TO "profitPercent";
ALTER TABLE "SalesOrderItem" RENAME COLUMN "taxAmount" TO "profitAmount";

ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_charges_valid";
UPDATE "InvoiceItem"
SET
  "discountCapAmount" = NULL,
  "profitAmount" = ROUND("grossAmount" * "profitPercent" / 100, 2),
  "discountAmount" = ROUND(("grossAmount" + ROUND("grossAmount" * "profitPercent" / 100, 2)) * "discountPercent" / 100, 2),
  "total" = ("grossAmount" + ROUND("grossAmount" * "profitPercent" / 100, 2)) - ROUND(("grossAmount" + ROUND("grossAmount" * "profitPercent" / 100, 2)) * "discountPercent" / 100, 2),
  "subtotal" = ("grossAmount" + ROUND("grossAmount" * "profitPercent" / 100, 2)) - ROUND(("grossAmount" + ROUND("grossAmount" * "profitPercent" / 100, 2)) * "discountPercent" / 100, 2)
WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE status = 'DRAFT');

UPDATE "Invoice" invoice
SET
  "subtotal" = totals.subtotal,
  "totalProfit" = totals."totalProfit",
  "totalDiscount" = totals."totalDiscount",
  "total" = totals.total
FROM (
  SELECT "invoiceId", SUM("grossAmount") AS subtotal, SUM("profitAmount") AS "totalProfit", SUM("discountAmount") AS "totalDiscount", SUM(total) AS total
  FROM "InvoiceItem"
  GROUP BY "invoiceId"
) totals
WHERE invoice.id = totals."invoiceId" AND invoice.status = 'DRAFT';

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_charges_valid" CHECK (
  "grossAmount" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND
  ("discountCapAmount" IS NULL OR "discountCapAmount" >= 0) AND
  "discountAmount" >= 0 AND "profitPercent" BETWEEN 0 AND 100 AND "profitAmount" >= 0 AND "total" >= 0 AND
  "grossAmount" = ROUND("quantity" * "unitPrice", 2) AND
  "profitAmount" = ROUND("grossAmount" * "profitPercent" / 100, 2) AND
  "discountAmount" = ROUND(("grossAmount" + "profitAmount") * "discountPercent" / 100, 2) AND
  "total" = "grossAmount" + "profitAmount" - "discountAmount" AND
  "subtotal" = "total"
);
