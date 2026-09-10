import type { AppRole } from "@prisma/client";

export const APP_ROLES = ["OWNER", "ADMIN_CUSTOMER", "ADMIN_PRODUCTION", "DESIGNER"] as const satisfies readonly AppRole[];
export const CRM_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const CRM_OPERATOR_ROLES = CRM_ROLES;
export const DEAL_ROLES = CRM_ROLES;
export const ARCHIVE_ROLES = CRM_OPERATOR_ROLES;
export const REVERSE_DEAL_ROLES = DEAL_ROLES;
export const USER_ADMIN_ROLES = ["OWNER"] as const satisfies readonly AppRole[];
export const MASTER_DATA_ROLES = [] as const satisfies readonly AppRole[];
export const ANALYTICS_ROLES = [] as const satisfies readonly AppRole[];
export const FINANCE_ROLES = [] as const satisfies readonly AppRole[];
export const PRODUCTION_ROLES = ["ADMIN_PRODUCTION"] as const satisfies readonly AppRole[];
export const PRODUCTION_MANAGEMENT_ROLES = PRODUCTION_ROLES;
export const DESIGN_ROLES = ["DESIGNER"] as const satisfies readonly AppRole[];
export const DESIGN_VIEW_ROLES = ["DESIGNER", "ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const DESIGN_APPROVER_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return role === "OWNER" || allowedRoles.includes(role);
}
