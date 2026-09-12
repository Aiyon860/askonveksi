import type { AppRole } from "@prisma/client";

import { CRM_ROLES, hasRole } from "@/lib/auth/permissions";

export const WHATSAPP_INBOX_ROLES = [...CRM_ROLES, "SALES"] as const satisfies readonly AppRole[];

export function canAccessWhatsAppInbox(role: AppRole) {
  return hasRole(role, WHATSAPP_INBOX_ROLES);
}
