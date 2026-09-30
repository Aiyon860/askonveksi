BEGIN;

ALTER TABLE "Opportunity" ADD COLUMN "productCategoryId" TEXT;
CREATE INDEX "Opportunity_productCategoryId_idx" ON "Opportunity"("productCategoryId");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
