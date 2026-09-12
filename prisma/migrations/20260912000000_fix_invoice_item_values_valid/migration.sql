-- Align InvoiceItem_values_valid with crm_order_documents_v2 semantics.
-- v2 defines item subtotal as the line total incl. tax (subtotal = total, enforced by
-- InvoiceItem_charges_valid), so the old clause "subtotal" = "quantity" * "unitPrice"
-- rejects every line with discount or tax. grossAmount equality is already covered by
-- InvoiceItem_charges_valid; keep only the basic guards here.
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_values_valid";

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_values_valid" CHECK (
  "position" >= 0 AND "quantity" > 0 AND "unitPrice" >= 0
);
