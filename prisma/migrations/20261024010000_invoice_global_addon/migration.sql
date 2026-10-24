-- Add On invoice berdiri sendiri di bawah seluruh produk (bukan lagi per baris produk).
-- Tabel InvoiceItemAddon lama sengaja TIDAK dihapus/diubah agar dokumen yang sudah
-- terbit sebelum perubahan ini tetap menampilkan nominal dan rincian yang sama.

CREATE TABLE IF NOT EXISTS "InvoiceAddon" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(240),
    "unitAmount" DECIMAL(18,2) NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAddon_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvoiceAddon_values_valid" CHECK ("qty" >= 1 AND "unitAmount" >= 0)
);

CREATE INDEX IF NOT EXISTS "InvoiceAddon_invoiceId_idx" ON "InvoiceAddon"("invoiceId");

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceAddon_invoiceId_position_key" ON "InvoiceAddon"("invoiceId", "position");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceAddon_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceAddon" ADD CONSTRAINT "InvoiceAddon_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
