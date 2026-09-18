ALTER TABLE "Customer" ADD COLUMN "poCustomerCode" VARCHAR(20);

CREATE UNIQUE INDEX "Customer_poCustomerCode_key" ON "Customer"("poCustomerCode");
