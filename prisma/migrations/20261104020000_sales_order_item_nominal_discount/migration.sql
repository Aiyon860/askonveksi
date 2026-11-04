-- InvoiceItem ber-diskon nominal disalin apa adanya ke SalesOrderItem saat Deal
-- (`items: { create: invoice.items }`), sehingga baris yang sama juga ditolak
-- SalesOrderItem_values_valid pada langkah berikutnya.
--
-- SalesOrderItem tidak punya kolom discountType, jadi relaksasi dibuat netral:
-- baris sah bila nominal konsisten dengan persen (diskon persen) ATAU persen
-- adalah hasil pembulatan 4 desimal dari nominal / gross (diskon nominal).
-- Diskon tetap tidak boleh melebihi gross dan invarian total tidak berubah.

ALTER TABLE "SalesOrderItem" DROP CONSTRAINT IF EXISTS "SalesOrderItem_values_valid";

ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_values_valid" CHECK (
  "position" >= 0
  AND "quantity" > 0
  AND "unitPrice" >= 0
  AND "grossAmount" >= 0
  AND "discountPercent" >= 0 AND "discountPercent" <= 100
  AND "discountCapAmount" IS NULL
  AND "discountAmount" >= 0
  AND "profitPercent" = 0
  AND "profitAmount" = 0
  AND "total" >= 0
  AND "grossAmount" >= round(quantity::numeric * "unitPrice", 2)
  AND "discountAmount" <= "grossAmount"
  AND (
    "discountAmount" = round("grossAmount" * "discountPercent" / 100, 2)
    OR ("grossAmount" > 0 AND "discountPercent" = round("discountAmount" * 100 / "grossAmount", 4))
    OR ("grossAmount" = 0 AND "discountAmount" = 0 AND "discountPercent" = 0)
  )
  AND "total" = "grossAmount" - "discountAmount"
  AND "subtotal" = "total"
);
