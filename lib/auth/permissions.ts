import type { AppRole } from "@prisma/client";

export const CRM_ROLES = ["OWNER", "ADMIN", "SALES"] as const satisfies readonly AppRole[];
export const ARCHIVE_ROLES = ["OWNER", "ADMIN", "SALES"] as const satisfies readonly AppRole[];
export const REVERSE_DEAL_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly AppRole[];
export const USER_ADMIN_ROLES = ["OWNER"] as const satisfies readonly AppRole[];
export const MASTER_DATA_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly AppRole[];

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(role);
}
