ALTER TABLE "Invoice"
  ALTER COLUMN "discountValue" TYPE DECIMAL(7,4) USING "discountValue"::DECIMAL(7,4);
ALTER TABLE "SalesOrder"
  ALTER COLUMN "discountValue" TYPE DECIMAL(7,4) USING "discountValue"::DECIMAL(7,4);

UPDATE "Invoice"
SET
  "discountValue" = COALESCE(ROUND("totalDiscount" / NULLIF("subtotal" + "totalProfit", 0) * 100, 4), 0),
  "discountType" = CASE WHEN "totalDiscount" > 0 THEN 'PERCENTAGE'::"DiscountType" ELSE 'NONE'::"DiscountType" END
WHERE status = 'DRAFT';

UPDATE "InvoiceItem" item
SET
  "discountPercent" = invoice."discountValue",
  "discountCapAmount" = NULL,
  "discountAmount" = ROUND((item."grossAmount" + item."profitAmount") * invoice."discountValue" / 100, 2),
  "total" = item."grossAmount" + item."profitAmount" - ROUND((item."grossAmount" + item."profitAmount") * invoice."discountValue" / 100, 2),
  "subtotal" = item."grossAmount" + item."profitAmount" - ROUND((item."grossAmount" + item."profitAmount") * invoice."discountValue" / 100, 2)
FROM "Invoice" invoice
WHERE item."invoiceId" = invoice.id AND invoice.status = 'DRAFT';

UPDATE "Invoice" invoice
SET
  "totalDiscount" = totals."totalDiscount",
  "total" = totals.total
FROM (
  SELECT "invoiceId", SUM("discountAmount") AS "totalDiscount", SUM(total) AS total
  FROM "InvoiceItem"
  GROUP BY "invoiceId"
) totals
WHERE invoice.id = totals."invoiceId" AND invoice.status = 'DRAFT';
