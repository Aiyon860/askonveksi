import "server-only";

import { forbidden } from "next/navigation";

import { hasRole, OWNER_ACTION_ROLES } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";

/**
 * Gate halaman area Owner (Pengaturan, Data Master, dst).
 * Developer dan Keuangan lolos lewat hasRole. Ditolak = 403.
 */
export async function requireOwnerAreaPage() {
  const actor = await getCurrentActor();
  if (!actor || !hasRole(actor.role, OWNER_ACTION_ROLES)) forbidden();
  return actor;
}
