BEGIN;

CREATE TABLE "PendingDealPayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "kind" "PaymentKind" NOT NULL,
  "initialValueType" "PaymentValueType" NOT NULL,
  "initialValue" DECIMAL(18,2) NOT NULL,
  "initialAmount" DECIMAL(18,2) NOT NULL,
  "initialDueAt" DATE NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PendingDealPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingPaymentTerm" (
  "id" TEXT NOT NULL,
  "pendingPaymentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "valueType" "PaymentValueType" NOT NULL,
  "value" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "dueAt" DATE NOT NULL,
  CONSTRAINT "PendingPaymentTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingDealPayment_invoiceId_key" ON "PendingDealPayment"("invoiceId");
CREATE INDEX "PendingDealPayment_initialDueAt_idx" ON "PendingDealPayment"("initialDueAt");
CREATE UNIQUE INDEX "PendingPaymentTerm_pendingPaymentId_position_key" ON "PendingPaymentTerm"("pendingPaymentId", "position");
CREATE INDEX "PendingPaymentTerm_pendingPaymentId_dueAt_idx" ON "PendingPaymentTerm"("pendingPaymentId", "dueAt");

ALTER TABLE "PendingDealPayment" ADD CONSTRAINT "PendingDealPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingPaymentTerm" ADD CONSTRAINT "PendingPaymentTerm_pendingPaymentId_fkey" FOREIGN KEY ("pendingPaymentId") REFERENCES "PendingDealPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PendingDealPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingPaymentTerm" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PendingDealPayment", "PendingPaymentTerm" FROM anon, authenticated;

COMMIT;
