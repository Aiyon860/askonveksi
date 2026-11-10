-- CreateTable
CREATE TABLE "AiApiToken" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenHint" VARCHAR(12) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read:analytics']::TEXT[],
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiApiEvent" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "endpoint" VARCHAR(120) NOT NULL,
    "params" VARCHAR(500),
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiApiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiApiToken_tokenHash_key" ON "AiApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AiApiToken_revokedAt_idx" ON "AiApiToken"("revokedAt");

-- CreateIndex
CREATE INDEX "AiApiEvent_createdAt_idx" ON "AiApiEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AiApiEvent_tokenId_createdAt_idx" ON "AiApiEvent"("tokenId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiApiToken" ADD CONSTRAINT "AiApiToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiApiEvent" ADD CONSTRAINT "AiApiEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "AiApiToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

