ALTER TABLE "PaymentTransaction" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "PurchaseOrder" po
SET "garmentType" = pwo."route"::text::"GarmentType"
FROM "SalesOrder" so
JOIN "ProductionWorkOrder" pwo ON pwo."salesOrderId" = so."id"
WHERE so."purchaseOrderId" = po."id"
  AND po."garmentType" IS NULL;

UPDATE "PurchaseOrder"
SET "garmentType" = 'JERSEY'
WHERE "purchaseOrderNo" = 'PO-2026-00001'
  AND "garmentType" IS NULL
  AND LOWER(BTRIM("productName")) = 'jersey';

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_agreed_production_data_required"
CHECK ("status" <> 'AGREED' OR ("garmentType" IS NOT NULL AND "deadline" IS NOT NULL));

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_version_positive" CHECK ("version" > 0);
