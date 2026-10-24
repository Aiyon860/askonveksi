import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const PRISMA_SCHEMA_VERSION = "invoice-global-addon";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaPg({
    connectionString,
    // Dashboard menembak 13 query paralel + polling SWR (dashboard 30 dtk,
    // trends 30 dtk, pipeline 60 dtk, inbox 3 dtk) + halaman customers
    // (~7 checkout bersamaan). RTT ke pooler Sydney ±400-700ms, connect
    // dingin ±2,5 dtk. Burst beberapa request/tab bersamaan memenuhi pool
    // kecil hingga antrean timeout ("timeout exceeded when trying to
    // connect" dari pg-pool). max 20 memberi ruang burst 2-3 halaman
    // bersamaan; koneksi aktual di Supabase terpantau rendah (<15).
    max: 20,
    // DNS lambat (±5 dtk) membuat handshake ke pooler ±7 dtk; beri ruang agar
    // checkout antrean tidak timeout.
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}

function hasCurrentModelDelegates(client: PrismaClient) {
  const delegates = client as unknown as Record<string, { findMany?: unknown } | undefined>;
  return ["garmentSize", "businessProfile", "paymentMethod", "paymentTransaction", "designTask", "designRevision", "whatsAppCampaign", "expense", "invoiceItemAddon", "invoiceAddon", "invoiceSettingPoint", "attendance", "attendanceHoliday"].every(
    (model) => typeof delegates[model]?.findMany === "function",
  );
}

export function getPrismaClient() {
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    (!hasCurrentModelDelegates(globalForPrisma.prisma) || globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION)
  ) {
    const staleClient = globalForPrisma.prisma;
    globalForPrisma.prisma = undefined;
    void staleClient.$disconnect().catch(() => undefined);
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return globalForPrisma.prisma;
}
