-- R7: Deposit dicatat terpisah dari DP di Sales Order.
-- 1) Kolom penanda transaksi deposit.
ALTER TABLE "PaymentTransaction" ADD COLUMN "isDeposit" BOOLEAN NOT NULL DEFAULT false;

-- 2) Invarian "satu transaksi awal aktif per pembayaran" kini hanya untuk DP;
--    transaksi deposit (isDeposit) boleh berdiri sejajar.
DROP INDEX "PaymentTransaction_one_active_initial";
CREATE UNIQUE INDEX "PaymentTransaction_one_active_initial" ON "PaymentTransaction"("paymentId") WHERE "status" = 'ACTIVE' AND "paymentTermId" IS NULL AND "isDeposit" = false;

-- 3) Pecah transaksi gabungan lama ("… · Termasuk deposit desain") menjadi
--    transaksi deposit tersendiri + transaksi DP murni.
--    Guard: nominal transaksi gabungan >= deposit (baris yang pernah diedit
--    tidak tersentuh), dan pembayaran belum punya transaksi deposit.
--    outstandingAmount tidak diubah (rumusnya kini total − deposit − initialAmount,
--    nilainya identik dengan rumus lama total − initialAmount gabungan).
WITH targets AS (
  SELECT
    dp."id" AS "paymentId",
    dep."amount" AS "depositAmount",
    dep."paidAt" AS "depositPaidAt",
    dep."paymentMethodId" AS "depositPaymentMethodId",
    dep."reference" AS "depositReference",
    dep."note" AS "depositNote",
    dep."createdById" AS "depositCreatedById",
    (
      SELECT p2."id"
      FROM "PaymentTransaction" p2
      WHERE p2."paymentId" = dp."id"
        AND p2."paymentTermId" IS NULL
        AND p2."status" = 'ACTIVE'
        AND p2."isDeposit" = false
        AND p2."note" LIKE '%Termasuk deposit desain%'
      ORDER BY p2."createdAt" DESC
      LIMIT 1
    ) AS "combinedTxId"
  FROM "DealPayment" dp
  JOIN "SalesOrder" so ON so."id" = dp."salesOrderId"
  JOIN "PurchaseOrderDeposit" dep ON dep."purchaseOrderId" = so."purchaseOrderId"
),
split AS (
  SELECT t.*
  FROM targets t
  JOIN "PaymentTransaction" pt ON pt."id" = t."combinedTxId"
  WHERE pt."amount" >= t."depositAmount"
    AND NOT EXISTS (
      SELECT 1 FROM "PaymentTransaction" d
      WHERE d."paymentId" = t."paymentId" AND d."isDeposit" = true
    )
),
inserted AS (
  INSERT INTO "PaymentTransaction" (
    "id", "paymentId", "paymentTermId", "paymentMethodId", "amount", "isDeposit",
    "paidAt", "reference", "note", "status", "createdById", "createdAt"
  )
  SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    s."paymentId",
    NULL,
    s."depositPaymentMethodId",
    s."depositAmount",
    true,
    s."depositPaidAt",
    s."depositReference",
    'Deposit desain' || COALESCE(' · ' || NULLIF(s."depositNote", ''), ''),
    'ACTIVE',
    s."depositCreatedById",
    now()
  FROM split s
  RETURNING "id"
),
updated_transaction AS (
  UPDATE "PaymentTransaction" pt
  SET
    "amount" = pt."amount" - s."depositAmount",
    "note" = NULLIF(regexp_replace(pt."note", '\s*·?\s*Termasuk deposit desain\s*$', ''), '')
  FROM split s
  WHERE pt."id" = s."combinedTxId"
  RETURNING pt."id"
),
updated_payment AS (
  UPDATE "DealPayment" dp
  SET "initialAmount" = dp."initialAmount" - s."depositAmount"
  FROM split s
  WHERE dp."id" = s."paymentId"
  RETURNING dp."id"
)
SELECT
  (SELECT count(*) FROM inserted) AS inserted_transactions,
  (SELECT count(*) FROM updated_transaction) AS updated_transactions,
  (SELECT count(*) FROM updated_payment) AS updated_payments;
