-- Baris invoice kini dapat berupa produk PO atau produk tambahan khusus invoice.
-- Nilai berisi id PurchaseOrderItem (atau "__legacy__" untuk PO lama tanpa item),
-- dan NULL untuk produk tambahan yang tidak berasal dari PO.
ALTER TABLE "InvoiceItem"
  ADD COLUMN "purchaseOrderItemId" VARCHAR(64);
