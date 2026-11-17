-- Kanban Pipeline CRM:
--   * "pinnedAt" menyimpan kapan kartu disematkan (hanya relevan di Follow Up/Negosiasi).
--   * "stageEnteredAt" menyimpan kapan kartu masuk ke tahap yang sekarang, untuk label
--     "14 hari di Follow Up".
ALTER TABLE "Opportunity"
  ADD COLUMN "stageEnteredAt" TIMESTAMPTZ(3),
  ADD COLUMN "pinnedAt" TIMESTAMPTZ(3);

-- Backfill dari aktivitas perpindahan tahap terakhir; data lama tanpa jejak aktivitas
-- memakai updatedAt supaya umur kartu tidak tampil kosong.
UPDATE "Opportunity" o
SET "stageEnteredAt" = COALESCE(
  (
    SELECT max(a."createdAt")
    FROM "CommunicationActivity" a
    WHERE a."opportunityId" = o.id
      AND (
        a."metadata"->>'to' = o."stage"::text
        OR a."metadata"->>'stage' = o."stage"::text
      )
  ),
  o."updatedAt"
);
