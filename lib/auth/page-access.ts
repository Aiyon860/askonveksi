import type { AppRole } from "@prisma/client";

import { WHATSAPP_INBOX_ROLES } from "../whatsapp/access.ts";

import {
  ANALYTICS_ROLES,
  ATTENDANCE_ADMIN_ROLES,
  AUDIT_VIEW_ROLES,
  CRM_OPERATOR_ROLES,
  CRM_VIEW_ROLES,
  DASHBOARD_ROLES,
  FINANCE_ROLES,
  GARMENT_SIZE_ROLES,
  MASTER_DATA_ADMIN_ROLES,
  OWNER_ACTION_ROLES,
  PRODUCTION_VIEW_ROLES,
  USER_ADMIN_ROLES,
  hasRole,
  isAttendanceOnly,
} from "./permissions.ts";

type AccessRule = {
  /** Prefix path tanpa trailing slash. */
  path: string;
  roles: readonly AppRole[];
};

/**
 * Matriks akses halaman area aplikasi (`app/(app)`).
 *
 * Aturan diurutkan dari yang paling spesifik. `hasRole` tetap meloloskan
 * DEVELOPER (dan OWNER/KEUANGAN sesuai kontrak lama), jadi pengecualian role
 * tidak pernah mengunci akun Developer — sesuai aturan proyek.
 *
 * Path yang tidak terdaftar (mis. `/absensi`) terbuka untuk semua pengguna
 * yang sudah masuk; halaman tersebut punya aturan sendiri di dalam page.
 */
const ACCESS_RULES: readonly AccessRule[] = [
  { path: "/absensi/laporan", roles: ATTENDANCE_ADMIN_ROLES },
  { path: "/dashboard", roles: DASHBOARD_ROLES },
  { path: "/keuangan", roles: FINANCE_ROLES },
  { path: "/crm/follow-up", roles: CRM_OPERATOR_ROLES },
  { path: "/crm", roles: CRM_VIEW_ROLES },
  { path: "/customers", roles: CRM_VIEW_ROLES },
  { path: "/sales-orders", roles: CRM_VIEW_ROLES },
  { path: "/whatsapp/jobs", roles: CRM_OPERATOR_ROLES },
  { path: "/whatsapp", roles: WHATSAPP_INBOX_ROLES },
  { path: "/campaigns", roles: CRM_OPERATOR_ROLES },
  { path: "/produksi", roles: PRODUCTION_VIEW_ROLES },
  { path: "/detail-desain", roles: PRODUCTION_VIEW_ROLES },
  { path: "/analytics", roles: ANALYTICS_ROLES },
  { path: "/log-aktivitas", roles: AUDIT_VIEW_ROLES },
  { path: "/admin/users", roles: USER_ADMIN_ROLES },
  { path: "/settings", roles: OWNER_ACTION_ROLES },
  { path: "/master-data/garment-sizes", roles: GARMENT_SIZE_ROLES },
  { path: "/master-data/whatsapp", roles: CRM_OPERATOR_ROLES },
  { path: "/master-data", roles: MASTER_DATA_ADMIN_ROLES },
];

function normalizePath(pathname: string) {
  const withoutQuery = pathname.split("?")[0].split("#")[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1);
  return withoutQuery;
}

function matchesRule(pathname: string, rulePath: string) {
  return pathname === rulePath || pathname.startsWith(`${rulePath}/`);
}

/**
 * True bila role boleh membuka path tersebut. Dipakai guard layout `(app)`.
 *
 * Desainer dan Admin Saga hanya bertugas absen: semua path ditolak kecuali
 * `/absensi` (laporan absensi tetap milik Owner lewat aturan di atas).
 */
export function canAccessPath(role: AppRole, pathname: string | null | undefined) {
  if (!pathname) return true;
  const normalized = normalizePath(pathname);
  if (!normalized) return true;

  const rule = ACCESS_RULES.find((item) => matchesRule(normalized, item.path));
  if (isAttendanceOnly(role)) {
    if (rule) return hasRole(role, rule.roles);
    return normalized === "/absensi" || normalized.startsWith("/absensi/");
  }
  if (!rule) return true;
  return hasRole(role, rule.roles);
}
