-- Gambar campaign (permanen) + media sementara untuk broadcast.
-- Broadcast: file dipakai semua job penerima, lalu dihapus worker saat
-- "remaining" mencapai 0; baris kedaluwarsa dibersihkan sweeper worker.

ALTER TABLE "WhatsAppCampaign"
  ADD COLUMN IF NOT EXISTS "imagePath" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "imageMimeType" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "imageFileName" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "imageSizeBytes" INTEGER;

CREATE TABLE IF NOT EXISTS "WhatsAppTempMedia" (
  "id" TEXT NOT NULL,
  "path" VARCHAR(300) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "fileName" VARCHAR(160) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "remaining" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppTempMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppTempMedia_path_key" ON "WhatsAppTempMedia"("path");
CREATE INDEX IF NOT EXISTS "WhatsAppTempMedia_expiresAt_idx" ON "WhatsAppTempMedia"("expiresAt");
CREATE INDEX IF NOT EXISTS "WhatsAppTempMedia_remaining_idx" ON "WhatsAppTempMedia"("remaining");
