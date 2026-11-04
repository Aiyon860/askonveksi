-- Diskon nominal per baris invoice sebelumnya ditolak database.
--
-- Aplikasi menyimpan nominal sebagai nilai otoritatif dan menurunkan persen
-- 4 desimal dari nominal / gross (mis. 50.000 dari 600.000 = 8,3333%). Klausul
-- lama `"discountAmount" = round("grossAmount" * "discountPercent" / 100, 2)`
-- hanya benar untuk diskon persen, sehingga draft invoice dengan diskon Rp
-- gagal disimpan (SQLSTATE 23514 pada InvoiceItem_charges_valid).
--
-- Relaksasi: baris tetap sah bila (a) persen yang dikirim konsisten dengan
-- nominal (diskon persen), atau (b) baris ber-diskon nominal dan persen
-- tersimpan adalah hasil pembulatan 4 desimal dari nominal / gross — rumus yang
-- sama dengan `resolveDiscount()` pada lib/crm/invoice-calculation.ts.
-- Invarian lain tidak berubah: total = gross - diskon, subtotal = total, serta
-- diskon tidak boleh melebihi gross.

ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_charges_valid";

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_charges_valid" CHECK (
  "grossAmount" >= 0
  AND "discountPercent" >= 0 AND "discountPercent" <= 100
  AND "discountCapAmount" IS NULL
  AND "discountAmount" >= 0
  AND "profitPercent" = 0
  AND "profitAmount" = 0
  AND "total" >= 0
  AND "grossAmount" >= round(quantity::numeric * "unitPrice", 2)
  AND (
    "discountAmount" = round("grossAmount" * "discountPercent" / 100, 2)
    OR (
      "discountType" = 'NOMINAL'
      AND "discountAmount" <= "grossAmount"
      AND (
        ("grossAmount" > 0 AND "discountPercent" = round("discountAmount" * 100 / "grossAmount", 4))
        OR ("grossAmount" = 0 AND "discountAmount" = 0 AND "discountPercent" = 0)
      )
    )
  )
  AND "total" = "grossAmount" - "discountAmount"
  AND "subtotal" = "total"
);
