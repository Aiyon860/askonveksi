import "server-only";

import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export async function getFollowUpSettings() {
  await requireActor(CRM_OPERATOR_ROLES);
  return getPrismaClient().businessProfile.findUniqueOrThrow({
    where: { id: "default" },
    select: { invoiceReminderOffsets: true, version: true },
  });
}
