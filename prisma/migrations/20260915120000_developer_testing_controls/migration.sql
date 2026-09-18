ALTER TYPE "WhatsAppJobType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_TEST';

ALTER TABLE "WhatsAppAutomationJob" ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "WhatsAppAutomationJob" DROP CONSTRAINT "WhatsAppAutomationJob_customerId_fkey";
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
