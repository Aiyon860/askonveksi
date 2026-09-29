-- P0-6: pg_trgm agar search ILIKE '%q%' (ID -> AU) tak seq-scan full-table.
-- Prisma migrate deploy berjalan dalam transaksi, jadi tanpa CONCURRENTLY.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Customer_name_trgm" ON "Customer" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_companyName_trgm" ON "Customer" USING GIN ("companyName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PurchaseOrder_no_trgm" ON "PurchaseOrder" USING GIN ("purchaseOrderNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PurchaseOrder_product_trgm" ON "PurchaseOrder" USING GIN ("productName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Expense_purpose_trgm" ON "Expense" USING GIN ("purpose" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Invoice_invoiceNo_trgm" ON "Invoice" USING GIN ("invoiceNo" gin_trgm_ops);
