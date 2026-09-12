CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('DISCONNECTED', 'PAIRING', 'CONNECTED', 'LOGGED_OUT', 'ERROR');
CREATE TYPE "WhatsAppConsentStatus" AS ENUM ('UNKNOWN', 'OPTED_IN', 'OPTED_OUT');
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "WhatsAppMessageKind" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT');
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');
CREATE TYPE "WhatsAppJobType" AS ENUM ('MANUAL', 'NEXT_ACTION', 'REPEAT_ORDER', 'REACTIVATION', 'INVOICE_ISSUED', 'INVOICE_DUE');
CREATE TYPE "WhatsAppJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'RETRY', 'FAILED', 'CANCELLED');

ALTER TABLE "Customer"
  ADD COLUMN "whatsappConsentStatus" "WhatsAppConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "whatsappOptedInAt" TIMESTAMPTZ(3),
  ADD COLUMN "whatsappOptInSource" VARCHAR(120),
  ADD COLUMN "whatsappOptedOutAt" TIMESTAMPTZ(3),
  ADD COLUMN "whatsappOptOutReason" VARCHAR(500);

ALTER TABLE "CommunicationActivity" ADD COLUMN "whatsappMessageId" TEXT;

CREATE TABLE "WhatsAppAccount" (
  "id" TEXT NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "phoneNumber" VARCHAR(20) NOT NULL,
  "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "sendEnabled" BOOLEAN NOT NULL DEFAULT false,
  "connectRequestedAt" TIMESTAMPTZ(3),
  "disconnectRequestedAt" TIMESTAMPTZ(3),
  "pairingCode" VARCHAR(32),
  "pairingCodeExpiresAt" TIMESTAMPTZ(3),
  "connectedAt" TIMESTAMPTZ(3),
  "disconnectedAt" TIMESTAMPTZ(3),
  "heartbeatAt" TIMESTAMPTZ(3),
  "lastError" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppAccount_phone_valid" CHECK ("phoneNumber" ~ '^[1-9][0-9]{7,14}$')
);

CREATE TABLE "WhatsAppTemplate" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "triggerType" "WhatsAppJobType" NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppTemplate_body_required" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "WhatsAppTemplate_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "WhatsAppConversation" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "remoteJid" VARCHAR(80) NOT NULL,
  "customerId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "lastMessageAt" TIMESTAMPTZ(3),
  "lastMessagePreview" VARCHAR(240),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppConversation_unread_nonnegative" CHECK ("unreadCount" >= 0)
);

CREATE TABLE "WhatsAppAutomationJob" (
  "id" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(240) NOT NULL,
  "type" "WhatsAppJobType" NOT NULL,
  "status" "WhatsAppJobStatus" NOT NULL DEFAULT 'QUEUED',
  "accountId" TEXT,
  "templateId" TEXT,
  "customerId" TEXT NOT NULL,
  "opportunityId" TEXT,
  "invoiceId" TEXT,
  "reminderId" TEXT,
  "payload" JSONB NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "leaseOwner" VARCHAR(120),
  "leaseExpiresAt" TIMESTAMPTZ(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "lastError" VARCHAR(500),
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppAutomationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppAutomationJob_attempts_nonnegative" CHECK ("attempts" >= 0)
);

CREATE TABLE "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "whatsappMessageId" VARCHAR(160),
  "direction" "WhatsAppMessageDirection" NOT NULL,
  "kind" "WhatsAppMessageKind" NOT NULL DEFAULT 'TEXT',
  "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
  "text" TEXT,
  "mediaPath" VARCHAR(500),
  "mediaMimeType" VARCHAR(120),
  "mediaFileName" VARCHAR(255),
  "mediaSizeBytes" INTEGER,
  "sentById" TEXT,
  "automationJobId" TEXT,
  "errorMessage" VARCHAR(500),
  "sentAt" TIMESTAMPTZ(3),
  "deliveredAt" TIMESTAMPTZ(3),
  "readAt" TIMESTAMPTZ(3),
  "failedAt" TIMESTAMPTZ(3),
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppMessage_content_present" CHECK ("text" IS NOT NULL OR "mediaPath" IS NOT NULL),
  CONSTRAINT "WhatsAppMessage_media_size_nonnegative" CHECK ("mediaSizeBytes" IS NULL OR "mediaSizeBytes" >= 0)
);

CREATE UNIQUE INDEX "WhatsAppAccount_phoneNumber_key" ON "WhatsAppAccount"("phoneNumber");
CREATE UNIQUE INDEX "WhatsAppAccount_one_sender_enabled_key" ON "WhatsAppAccount"("sendEnabled") WHERE "sendEnabled" = true;
CREATE INDEX "WhatsAppAccount_sendEnabled_status_idx" ON "WhatsAppAccount"("sendEnabled", "status");
CREATE INDEX "WhatsAppAccount_heartbeatAt_idx" ON "WhatsAppAccount"("heartbeatAt");
CREATE UNIQUE INDEX "WhatsAppTemplate_name_key" ON "WhatsAppTemplate"("name");
CREATE UNIQUE INDEX "WhatsAppTemplate_one_active_trigger_key" ON "WhatsAppTemplate"("triggerType") WHERE "isActive" = true;
CREATE INDEX "WhatsAppTemplate_triggerType_isActive_idx" ON "WhatsAppTemplate"("triggerType", "isActive");
CREATE UNIQUE INDEX "WhatsAppConversation_accountId_remoteJid_key" ON "WhatsAppConversation"("accountId", "remoteJid");
CREATE INDEX "WhatsAppConversation_customerId_lastMessageAt_idx" ON "WhatsAppConversation"("customerId", "lastMessageAt");
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");
CREATE INDEX "WhatsAppConversation_isResolved_unreadCount_lastMessageAt_idx" ON "WhatsAppConversation"("isResolved", "unreadCount", "lastMessageAt");
CREATE UNIQUE INDEX "WhatsAppAutomationJob_idempotencyKey_key" ON "WhatsAppAutomationJob"("idempotencyKey");
CREATE INDEX "WhatsAppAutomationJob_status_scheduledAt_idx" ON "WhatsAppAutomationJob"("status", "scheduledAt");
CREATE INDEX "WhatsAppAutomationJob_status_leaseExpiresAt_idx" ON "WhatsAppAutomationJob"("status", "leaseExpiresAt");
CREATE INDEX "WhatsAppAutomationJob_customerId_status_scheduledAt_idx" ON "WhatsAppAutomationJob"("customerId", "status", "scheduledAt");
CREATE INDEX "WhatsAppAutomationJob_invoiceId_type_scheduledAt_idx" ON "WhatsAppAutomationJob"("invoiceId", "type", "scheduledAt");
CREATE INDEX "WhatsAppAutomationJob_opportunityId_type_scheduledAt_idx" ON "WhatsAppAutomationJob"("opportunityId", "type", "scheduledAt");
CREATE UNIQUE INDEX "WhatsAppMessage_automationJobId_key" ON "WhatsAppMessage"("automationJobId");
CREATE UNIQUE INDEX "WhatsAppMessage_accountId_whatsappMessageId_key" ON "WhatsAppMessage"("accountId", "whatsappMessageId");
CREATE INDEX "WhatsAppMessage_conversationId_occurredAt_id_idx" ON "WhatsAppMessage"("conversationId", "occurredAt", "id");
CREATE INDEX "WhatsAppMessage_status_createdAt_idx" ON "WhatsAppMessage"("status", "createdAt");
CREATE INDEX "WhatsAppMessage_sentById_createdAt_idx" ON "WhatsAppMessage"("sentById", "createdAt");
CREATE UNIQUE INDEX "CommunicationActivity_whatsappMessageId_key" ON "CommunicationActivity"("whatsappMessageId");

ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAutomationJob" ADD CONSTRAINT "WhatsAppAutomationJob_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "CustomerReminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_automationJobId_fkey" FOREIGN KEY ("automationJobId") REFERENCES "WhatsAppAutomationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationActivity" ADD CONSTRAINT "CommunicationActivity_whatsappMessageId_fkey" FOREIGN KEY ("whatsappMessageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppAutomationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppMessage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WhatsAppAccount", "WhatsAppTemplate", "WhatsAppConversation", "WhatsAppAutomationJob", "WhatsAppMessage" FROM anon, authenticated;
