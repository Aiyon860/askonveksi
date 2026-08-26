import { getPrismaClient } from "@/lib/prisma";

/**
 * Temporary connection check for the existing `test` table.
 * Once the application schema is defined, replace this raw query with a
 * generated Prisma model query (for example, `prisma.user.findMany()`).
 */
export function getTestRows() {
  return getPrismaClient().$queryRaw<unknown[]>`SELECT * FROM "test" LIMIT 1`;
}
