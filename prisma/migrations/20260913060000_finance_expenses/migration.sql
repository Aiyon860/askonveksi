CREATE TYPE "ExpensePaymentMethod" AS ENUM ('QRIS', 'TUNAI', 'BANK_A', 'BANK_B', 'PRIBADI');

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "purpose" VARCHAR(500) NOT NULL,
  "spentAt" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paymentMethod" "ExpensePaymentMethod" NOT NULL,
  "createdById" TEXT NOT NULL,
  "reimbursedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Expense_createdById_spentAt_idx" ON "Expense"("createdById", "spentAt");
CREATE INDEX "Expense_paymentMethod_spentAt_idx" ON "Expense"("paymentMethod", "spentAt");
