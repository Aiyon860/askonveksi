ALTER TABLE "Expense"
  ADD COLUMN "proofPath" VARCHAR(500),
  ADD COLUMN "proofFileName" VARCHAR(255),
  ADD COLUMN "proofMimeType" VARCHAR(100),
  ADD COLUMN "proofSize" INTEGER,
  ADD CONSTRAINT "Expense_proof_metadata_complete"
    CHECK (("proofPath" IS NULL AND "proofFileName" IS NULL AND "proofMimeType" IS NULL AND "proofSize" IS NULL)
      OR ("proofPath" IS NOT NULL AND "proofFileName" IS NOT NULL AND "proofMimeType" IS NOT NULL AND "proofSize" IS NOT NULL));

ALTER TABLE "PaymentTransaction"
  ADD COLUMN "proofPath" VARCHAR(500),
  ADD COLUMN "proofFileName" VARCHAR(255),
  ADD COLUMN "proofMimeType" VARCHAR(100),
  ADD COLUMN "proofSize" INTEGER,
  ADD CONSTRAINT "PaymentTransaction_proof_metadata_complete"
    CHECK (("proofPath" IS NULL AND "proofFileName" IS NULL AND "proofMimeType" IS NULL AND "proofSize" IS NULL)
      OR ("proofPath" IS NOT NULL AND "proofFileName" IS NOT NULL AND "proofMimeType" IS NOT NULL AND "proofSize" IS NOT NULL));
