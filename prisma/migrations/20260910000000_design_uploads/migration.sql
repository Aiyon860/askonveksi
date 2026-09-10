BEGIN;

ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'DESIGNER';

CREATE TABLE "DesignTask" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "deadline" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DesignTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesignRevision" (
  "id" TEXT NOT NULL,
  "designTaskId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesignAttachment" (
  "id" TEXT NOT NULL,
  "designRevisionId" TEXT NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "kind" "PurchaseOrderAttachmentKind" NOT NULL DEFAULT 'OTHER',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignTask_purchaseOrderId_key" ON "DesignTask"("purchaseOrderId");
CREATE INDEX "DesignTask_deadline_idx" ON "DesignTask"("deadline");
CREATE UNIQUE INDEX "DesignRevision_designTaskId_revision_key" ON "DesignRevision"("designTaskId", "revision");
CREATE INDEX "DesignRevision_createdById_createdAt_idx" ON "DesignRevision"("createdById", "createdAt");
CREATE INDEX "DesignAttachment_designRevisionId_createdAt_idx" ON "DesignAttachment"("designRevisionId", "createdAt");

ALTER TABLE "DesignTask" ADD CONSTRAINT "DesignTask_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_designTaskId_fkey" FOREIGN KEY ("designTaskId") REFERENCES "DesignTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignAttachment" ADD CONSTRAINT "DesignAttachment_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
