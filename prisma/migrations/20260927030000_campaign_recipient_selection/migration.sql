-- Penerima terpilih per campaign (PromptMatang butir 16).
-- Campaign hanya dikirim ke customer yang tersimpan di tabel ini.
CREATE TABLE "WhatsAppCampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppCampaignRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppCampaignRecipient_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WhatsAppCampaignRecipient_campaignId_customerId_key" ON "WhatsAppCampaignRecipient"("campaignId", "customerId");
CREATE INDEX "WhatsAppCampaignRecipient_customerId_idx" ON "WhatsAppCampaignRecipient"("customerId");
