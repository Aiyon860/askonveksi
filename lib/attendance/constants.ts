import type { AttendanceStatus } from "@prisma/client";

export const ATTENDANCE_TIME_ZONE = "Asia/Jakarta";
export const ATTENDANCE_DEFAULT_CHECK_IN_TIME = "08:00";
export const ATTENDANCE_DEFAULT_LATE_TOLERANCE_MIN = 15;
export const ATTENDANCE_DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6] as const;
export const ATTENDANCE_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ATTENDANCE_MAX_RANGE_DAYS = 366;
export const ATTENDANCE_MAX_NOTE_LENGTH = 500;
export const ATTENDANCE_MAX_HOLIDAY_NAME_LENGTH = 120;

export const ATTENDANCE_STATUSES = ["HADIR", "TERLAMBAT", "IZIN", "ALPHA"] as const satisfies readonly AttendanceStatus[];
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_REPORT_STATUSES = ["HADIR", "TERLAMBAT", "IZIN", "ALPHA", "BELUM_ABSEN"] as const;
export type AttendanceReportStatusValue = (typeof ATTENDANCE_REPORT_STATUSES)[number];
export type AttendanceStatusFilter = AttendanceReportStatusValue | "ALL";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceReportStatusValue, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  ALPHA: "Alpha",
  BELUM_ABSEN: "Belum absen",
};

export const ATTENDANCE_SOURCE_LABEL = {
  SELF: "Mandiri",
  OWNER: "Owner",
} as const;

export const ATTENDANCE_WORK_DAY_OPTIONS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
] as const;

export function attendanceStatusLabel(status: AttendanceReportStatusValue) {
  return ATTENDANCE_STATUS_LABEL[status];
}

export function attendanceSourceLabel(source: "SELF" | "OWNER" | null | undefined) {
  if (!source) return "Otomatis";
  return ATTENDANCE_SOURCE_LABEL[source];
}
