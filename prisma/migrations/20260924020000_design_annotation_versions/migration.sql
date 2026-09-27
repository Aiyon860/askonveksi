ALTER TABLE "DesignAttachment"
  ADD COLUMN "originalPath" VARCHAR(500),
  ADD COLUMN "annotations" JSONB;
