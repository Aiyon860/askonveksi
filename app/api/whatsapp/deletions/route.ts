import { WHATSAPP_ACCOUNT_MANAGER_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getCurrentActor();
  if (!actor || !hasRole(actor.role, WHATSAPP_ACCOUNT_MANAGER_ROLES)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const pending = await getPrismaClient().whatsAppAccount.findMany({
    where: { deleteRequestedAt: { not: null } },
    select: { id: true, label: true },
    orderBy: { deleteRequestedAt: "asc" },
  });
  return Response.json({ pending }, { headers: { "Cache-Control": "no-store" } });
}
