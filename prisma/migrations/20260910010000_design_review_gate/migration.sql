BEGIN;

CREATE TYPE "DesignRevisionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "DesignRevision"
  ADD COLUMN "status" "DesignRevisionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewNotes" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMPTZ(3);

CREATE INDEX "DesignRevision_designTaskId_status_revision_idx" ON "DesignRevision"("designTaskId", "status", "revision");
CREATE INDEX "DesignRevision_reviewedById_reviewedAt_idx" ON "DesignRevision"("reviewedById", "reviewedAt");

ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "DesignTask" ("id", "purchaseOrderId", "deadline", "createdAt", "updatedAt")
SELECT CONCAT('legacy-design-', po."id"), po."id", COALESCE(po."deadline", CURRENT_DATE), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PurchaseOrder" po
LEFT JOIN "DesignTask" task ON task."purchaseOrderId" = po."id"
WHERE po."status" = 'DRAFT' AND task."id" IS NULL;

COMMIT;
