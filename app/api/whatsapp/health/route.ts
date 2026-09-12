import { MASTER_DATA_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { classifyWhatsAppHealth } from "@/lib/whatsapp/health";

export const dynamic = "force-dynamic";

function safeError(value: string | null) {
  return value?.split("\n", 1)[0]?.slice(0, 240) ?? null;
}

export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const manager = hasRole(actor.role, MASTER_DATA_ROLES);
  const prisma = getPrismaClient();
  const [account, ownJobs, failedCount] = await Promise.all([
    prisma.whatsAppAccount.findFirst({
      select: { label: true, phoneNumber: true, status: true, sendEnabled: true, heartbeatAt: true, lastError: true },
      orderBy: [{ sendEnabled: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.whatsAppAutomationJob.findMany({
      where: { type: "MANUAL", message: { is: { sentById: actor.id } } },
      select: { id: true, status: true, updatedAt: true, lastError: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.whatsAppAutomationJob.count({
      where: manager
        ? { status: "FAILED" }
        : { status: "FAILED", type: "MANUAL", message: { is: { sentById: actor.id } } },
    }),
  ]);
  const state = classifyWhatsAppHealth(account);

  return Response.json({
    state,
    account: account ? {
      label: account.label,
      phoneNumber: account.phoneNumber,
      sendEnabled: account.sendEnabled,
      status: account.status,
      heartbeatAt: account.heartbeatAt?.toISOString() ?? null,
      lastError: manager ? safeError(account.lastError) : null,
    } : null,
    ownJobs: ownJobs.map((job) => ({
      id: job.id,
      status: job.status,
      updatedAt: job.updatedAt.toISOString(),
      error: job.status === "FAILED" ? (manager ? safeError(job.lastError) : "Pengiriman gagal. Hubungi admin untuk pemeriksaan.") : null,
    })),
    failedCount,
    checkedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
