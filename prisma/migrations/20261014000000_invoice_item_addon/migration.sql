-- Add On per baris ukuran invoice: keterangan + nominal per pcs (dikalikan qty baris).
-- Total add-on menyatu ke gross baris sehingga ikut diskon per item, pajak, dan pembulatan Rp500.

CREATE TABLE IF NOT EXISTS "InvoiceItemAddon" (
    "id" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "unitAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItemAddon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceItemAddon_invoiceItemId_idx" ON "InvoiceItemAddon"("invoiceItemId");

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceItemAddon_invoiceItemId_position_key" ON "InvoiceItemAddon"("invoiceItemId", "position");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItemAddon_invoiceItemId_fkey') THEN
        ALTER TABLE "InvoiceItemAddon" ADD CONSTRAINT "InvoiceItemAddon_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
