BEGIN;

-- Preserve the former opportunity deadline on existing PO revisions that do
-- not have their own deadline yet. A PO deadline remains authoritative when
-- both records already contain a value.
UPDATE "PurchaseOrder" AS purchase_order
SET "deadline" = opportunity."deadline"
FROM "Opportunity" AS opportunity
WHERE purchase_order."opportunityId" = opportunity."id"
  AND purchase_order."deadline" IS NULL
  AND opportunity."deadline" IS NOT NULL;

-- Refuse to discard a deadline that cannot be moved to a PO. This keeps the
-- migration safe when another environment contains data not present here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Opportunity" AS opportunity
    WHERE opportunity."deadline" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "PurchaseOrder" AS purchase_order
        WHERE purchase_order."opportunityId" = opportunity."id"
      )
  ) THEN
    RAISE EXCEPTION 'Opportunity deadline without a related PurchaseOrder must be resolved before this migration';
  END IF;
END
$$;

DROP INDEX IF EXISTS "Opportunity_leadScore_stage_idx";
DROP INDEX IF EXISTS "Opportunity_stage_customerId_leadScore_nextActionAt_estimatedValue_idx";

ALTER TABLE "Opportunity"
  DROP CONSTRAINT IF EXISTS "Opportunity_customer_budget_nonnegative",
  DROP CONSTRAINT IF EXISTS "Opportunity_estimated_quantity_positive",
  DROP CONSTRAINT IF EXISTS "Opportunity_estimated_value_nonnegative",
  DROP CONSTRAINT IF EXISTS "Opportunity_lead_score_range";

ALTER TABLE "Opportunity"
  DROP COLUMN "designStatus",
  DROP COLUMN "customerBudget",
  DROP COLUMN "leadScore",
  DROP COLUMN "estimatedQuantity",
  DROP COLUMN "estimatedValue",
  DROP COLUMN "deadline";

DROP TYPE "DesignStatus";

COMMIT;
