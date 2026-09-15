CREATE TYPE "CustomerLifecycle" AS ENUM ('PROSPEK', 'CUSTOMER');

ALTER TABLE "Customer" ADD COLUMN "lifecycle" "CustomerLifecycle" NOT NULL DEFAULT 'CUSTOMER';

CREATE INDEX "Customer_lifecycle_archivedAt_updatedAt_idx" ON "Customer"("lifecycle", "archivedAt", "updatedAt");
