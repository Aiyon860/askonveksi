BEGIN;

CREATE TABLE "ProductCategory" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "garmentType" "GarmentType" NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductCategory_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "ProductCategory_name_not_blank" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");
CREATE UNIQUE INDEX "ProductCategory_name_ci_key" ON "ProductCategory"(LOWER(BTRIM("name")));
CREATE INDEX "ProductCategory_isActive_position_name_idx" ON "ProductCategory"("isActive", "position", "name");

ALTER TABLE "PurchaseOrder" ADD COLUMN "productCategoryId" TEXT;
CREATE INDEX "PurchaseOrder_productCategoryId_idx" ON "PurchaseOrder"("productCategoryId");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ProductCategory" FROM anon, authenticated;

COMMIT;
