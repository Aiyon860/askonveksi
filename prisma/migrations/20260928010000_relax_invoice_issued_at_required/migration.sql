-- The old clause forced every non-DRAFT invoice to carry issuedAt, which made
-- "Batalkan" fail on a draft invoice (status becomes CANCELLED while issuedAt is
-- still NULL) and would fail the same way for a draft revision (SUPERSEDED).
-- PurchaseOrder only guards AGREED, so cancelling a PO draft already worked.
-- Keep the real invariant: only an invoice that has actually been issued needs issuedAt.
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_issued_at_required";

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issued_at_required" CHECK (
  "status" <> 'ISSUED' OR "issuedAt" IS NOT NULL
);
