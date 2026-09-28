-- Default Repeat Order menjadi Off untuk customer baru (PromptMatang butir 15).
ALTER TABLE "Customer" ALTER COLUMN "orderReminderEnabled" SET DEFAULT false;

-- Semua customer yang sudah ada juga dimatikan, sehingga reminder otomatis berhenti
-- sampai Admin Customer menyalakannya kembali per customer.
UPDATE "Customer" SET "orderReminderEnabled" = false WHERE "orderReminderEnabled" = true;
