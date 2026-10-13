-- Add On per baris invoice menyatu ke gross baris (gross = qty * harga + add-on),
-- sehingga klausul kesetaraan "grossAmount" = round(quantity * "unitPrice") pada
-- InvoiceItem_charges_valid dan SalesOrderItem_values_valid menolak baris ber-add-on.
-- Relaksasi menjadi batas bawah: gross tidak boleh di bawah nilai dasar qty * harga.
-- Invarian ekonomi lain tetap eksak: total = gross - diskon, subtotal = total,
-- discountAmount = round(gross * discountPercent / 100), batas diskon 0-100%.
-- Baris lama (tanpa add-on, gross = qty * harga) tetap memenuhi batas baru.

ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_charges_valid";

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_charges_valid" CHECK (
  "grossAmount" >= 0
  AND "discountPercent" >= 0 AND "discountPercent" <= 100
  AND "discountCapAmount" IS NULL
  AND "discountAmount" >= 0
  AND "profitPercent" = 0
  AND "profitAmount" = 0
  AND "total" >= 0
  AND "grossAmount" >= round(quantity::numeric * "unitPrice", 2)
  AND "discountAmount" = round("grossAmount" * "discountPercent" / 100, 2)
  AND "total" = "grossAmount" - "discountAmount"
  AND "subtotal" = "total"
);

ALTER TABLE "SalesOrderItem" DROP CONSTRAINT "SalesOrderItem_values_valid";

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
  AND "discountAmount" = round("grossAmount" * "discountPercent" / 100, 2)
  AND "total" = "grossAmount" - "discountAmount"
  AND "subtotal" = "total"
);
