BEGIN;

ALTER TABLE "WhatsAppAccount" ADD COLUMN "deleteRequestedAt" TIMESTAMPTZ(3);

COMMIT;
