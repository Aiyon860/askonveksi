BEGIN;

CREATE TABLE "PaymentMethod" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentMethod_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "PaymentMethod_name_not_blank" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");
CREATE UNIQUE INDEX "PaymentMethod_name_ci_key" ON "PaymentMethod"(LOWER(BTRIM("name")));
CREATE INDEX "PaymentMethod_isActive_position_name_idx" ON "PaymentMethod"("isActive", "position", "name");

INSERT INTO "PaymentMethod" ("id", "name", "position", "isActive", "createdAt", "updatedAt") VALUES
  ('payment-method-tunai', 'Tunai', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-qris', 'QRIS', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-bank-a', 'BANK A', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment-method-bank-b', 'BANK B', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "PaymentTransaction" ADD COLUMN "paymentMethodId" TEXT;
CREATE INDEX "PaymentTransaction_paymentMethodId_idx" ON "PaymentTransaction"("paymentMethodId");
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PaymentMethod" FROM anon, authenticated;

COMMIT;
