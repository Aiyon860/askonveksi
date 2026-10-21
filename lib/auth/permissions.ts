import type { AppRole } from "@prisma/client";

export const APP_ROLES = ["DEVELOPER", "OWNER", "ADMIN_CUSTOMER", "ADMIN_PO", "KEUANGAN", "DESIGNER"] as const satisfies readonly AppRole[];
export const CRM_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
// ADMIN_PO (peran tunggal untuk melihat sisi CRM) hanya membaca dan mengunduh PDF — tanpa aksi tulis.
export const CRM_VIEW_ROLES = [...CRM_ROLES, "ADMIN_PO"] as const satisfies readonly AppRole[];
export const DASHBOARD_ROLES = [...CRM_VIEW_ROLES, "KEUANGAN"] as const satisfies readonly AppRole[];
export const CRM_OPERATOR_ROLES = CRM_ROLES;
// D1: Admin PO boleh mengunggah desain langsung (menjadi acuan detailing) — tanpa hak tulis CRM lain.
export const DESIGN_UPLOADER_ROLES = [...CRM_OPERATOR_ROLES, "ADMIN_PO"] as const satisfies readonly AppRole[];
export const CUSTOMER_REMINDER_SETTING_ROLES = ["OWNER", "ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const DEAL_ROLES = CRM_ROLES;
export const ARCHIVE_ROLES = CRM_OPERATOR_ROLES;
export const REVERSE_DEAL_ROLES = DEAL_ROLES;
export const USER_ADMIN_ROLES = ["DEVELOPER"] as const satisfies readonly AppRole[];
export const OWNER_ACTION_ROLES = ["OWNER"] as const satisfies readonly AppRole[];
// Absensi: Owner mengelola pengaturan, laporan, koreksi, dan hari libur.
// Developer selalu lolos lewat hasRole. Pegawai = semua role selain Owner/Developer.
export const ATTENDANCE_ADMIN_ROLES = OWNER_ACTION_ROLES;
export function isAttendanceEmployee(role: AppRole) {
  return role !== "OWNER" && role !== "DEVELOPER";
}
// Konten website dikelola Owner; Developer selalu lolos lewat hasRole.
export const CMS_ROLES = ["OWNER"] as const satisfies readonly AppRole[];
export const MASTER_DATA_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const WHATSAPP_ACCOUNT_MANAGER_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const ANALYTICS_ROLES = ["KEUANGAN"] as const satisfies readonly AppRole[];
// Log aktivitas (audit trail): Owner & Developer lolos otomatis lewat hasRole.
export const AUDIT_VIEW_ROLES = ["KEUANGAN"] as const satisfies readonly AppRole[];
export const FINANCE_ROLES = ["KEUANGAN"] as const satisfies readonly AppRole[];
export const PRODUCTION_ROLES = ["ADMIN_PO"] as const satisfies readonly AppRole[];
// G2: Admin Customer boleh melihat modul Produksi (kanban, detail Work Order, detail desain)
// dalam mode hanya lihat. Semua aksi ubah tetap dibatasi PRODUCTION_ROLES.
export const PRODUCTION_VIEW_ROLES = [...PRODUCTION_ROLES, "ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const PRODUCTION_MANAGEMENT_ROLES = PRODUCTION_ROLES;
export const DETAIL_DESIGN_ROLES = PRODUCTION_ROLES;
export const DETAIL_DESIGN_VIEW_ROLES = [...DETAIL_DESIGN_ROLES, "ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const DESIGN_ROLES = ["DESIGNER"] as const satisfies readonly AppRole[];
export const DESIGN_VIEW_ROLES = ["DESIGNER", "ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
export const DESIGN_APPROVER_ROLES = ["ADMIN_CUSTOMER"] as const satisfies readonly AppRole[];
// Peran yang selalu boleh melewati gate alur kerja (mis. gate deposit desain).
export const GATE_OVERRIDE_ROLES = ["DEVELOPER", "OWNER"] as const satisfies readonly AppRole[];

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return role === "DEVELOPER" || role === "OWNER" || allowedRoles.includes(role);
}
