import "server-only";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

/**
 * Rate limit per token memakai tabel bucket yang sudah ada
 * (`PublicRateLimitBucket`), dengan kunci berbeda per token.
 *
 * Jendela 1 menit: cukup untuk pemakaian wajar asisten AI (satu percakapan
 * biasanya < 20 panggilan), tetapi menahan loop tak sengaja.
 */
const WINDOW_SECONDS = 60;

export type AiRateLimitResult = { ok: boolean; remaining: number };

export async function checkAiRateLimit(tokenId: string, max = 60): Promise<AiRateLimitResult> {
  const prisma = getPrismaClient();
  const key = `ai:${tokenId}`.slice(0, 64);

  // Bersihkan bucket lama sekali jalan agar tabel tidak tumbuh selamanya.
  await prisma.publicRateLimitBucket
    .deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket" ("key", "windowStart", "count", "updatedAt")
    VALUES (${key}, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "PublicRateLimitBucket"."windowStart" <= CURRENT_TIMESTAMP - (${WINDOW_SECONDS} * INTERVAL '1 second') THEN 1
        ELSE "PublicRateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "PublicRateLimitBucket"."windowStart" <= CURRENT_TIMESTAMP - (${WINDOW_SECONDS} * INTERVAL '1 second') THEN CURRENT_TIMESTAMP
        ELSE "PublicRateLimitBucket"."windowStart"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count"
  `);

  const count = rows[0]?.count ?? max + 1;
  return { ok: count <= max, remaining: Math.max(max - count, 0) };
}
