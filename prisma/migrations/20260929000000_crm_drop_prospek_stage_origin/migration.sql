-- Asal pembuatan peluang agar kartu kanban dapat dibedakan (+ Prospek vs + Repeat Order).
CREATE TYPE "OpportunityOrigin" AS ENUM ('PROSPEK_FORM', 'REPEAT_ORDER', 'LANDING_PAGE', 'MANUAL');

ALTER TABLE "Opportunity" ADD COLUMN "origin" "OpportunityOrigin" NOT NULL DEFAULT 'MANUAL';

UPDATE "Opportunity" SET "origin" = 'REPEAT_ORDER' WHERE "isRepeatOrder" = true;
UPDATE "Opportunity" SET "origin" = 'LANDING_PAGE' WHERE "publicSubmissionKey" IS NOT NULL;
UPDATE "Opportunity" SET "origin" = 'PROSPEK_FORM' WHERE "origin" = 'MANUAL' AND "title" LIKE 'Prospek:%';

-- Kolom kanban Prospek dihapus dari board Pipeline: semua peluang baru memakai FOLLOW_UP.
ALTER TABLE "Opportunity" ALTER COLUMN "stage" SET DEFAULT 'FOLLOW_UP';
UPDATE "Opportunity" SET "stage" = 'FOLLOW_UP' WHERE "stage" = 'LEAD_BARU';
