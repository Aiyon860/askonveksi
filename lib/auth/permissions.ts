import type { AppRole } from "@prisma/client";

export const APP_ROLES = ["OWNER", "ADMIN", "SALES", "PRODUCTION", "QC"] as const satisfies readonly AppRole[];
export const CRM_ROLES = ["OWNER", "ADMIN", "SALES"] as const satisfies readonly AppRole[];
export const CRM_OPERATOR_ROLES = ["ADMIN", "SALES"] as const satisfies readonly AppRole[];
export const DEAL_ROLES = ["ADMIN"] as const satisfies readonly AppRole[];
export const ARCHIVE_ROLES = CRM_OPERATOR_ROLES;
export const REVERSE_DEAL_ROLES = DEAL_ROLES;
export const USER_ADMIN_ROLES = ["OWNER"] as const satisfies readonly AppRole[];
export const MASTER_DATA_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly AppRole[];
export const ANALYTICS_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly AppRole[];
export const PRODUCTION_ROLES = ["OWNER", "ADMIN", "PRODUCTION", "QC"] as const satisfies readonly AppRole[];
export const PRODUCTION_MANAGEMENT_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly AppRole[];

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(role);
}
