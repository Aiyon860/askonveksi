import type { AppRole, AttendanceSource, AttendanceStatus } from "@prisma/client";

import { ATTENDANCE_MAX_RANGE_DAYS, type AttendanceStatusFilter } from "./constants.ts";
import type { AttendanceSettings } from "./types.ts";
import {
  addDaysToDateKey,
  daysBetweenDateKeys,
  eachDateKey,
  isValidDateKey,
  jakartaDateKey,
  jakartaWeekday,
  monthKeyRange,
  utcDateToDateKey,
} from "./time.ts";

export type AttendanceEmployeeData = {
  id: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  createdAt: Date;
};

export type AttendanceRecordData = {
  id: string;
  userId: string;
  date: Date;
  status: AttendanceStatus;
  checkInAt: Date | null;
  note: string | null;
  photoPath: string | null;
  latitude: { toString(): string } | number | null;
  longitude: { toString(): string } | number | null;
  accuracyMeters: number | null;
  locationAt: Date | null;
  source: AttendanceSource;
  recordedById: string | null;
  correctedById: string | null;
  correctedAt: Date | null;
  updatedAt: Date;
  recordedBy: { name: string } | null;
  correctedBy: { name: string } | null;
};

export type AttendanceHolidayData = {
  date: Date;
  name: string;
};

export type AttendanceReportStatus = AttendanceStatus | "BELUM_ABSEN";

export type AttendanceReportRow = {
  key: string;
  attendanceId: string | null;
  userId: string;
  employeeName: string;
  employeeRole: AppRole;
  dateKey: string;
  status: AttendanceReportStatus;
  checkInAt: Date | null;
  note: string | null;
  hasPhoto: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationAt: Date | null;
  source: AttendanceSource | null;
  recordedByName: string | null;
  correctedByName: string | null;
  correctedAt: Date | null;
  updatedAt: Date | null;
  isDerived: boolean;
};

export type AttendanceReportSummary = {
  total: number;
  HADIR: number;
  TERLAMBAT: number;
  IZIN: number;
  ALPHA: number;
  BELUM_ABSEN: number;
  attendanceRate: number;
};

function decimalToNumber(value: AttendanceRecordData["latitude"]) {
  if (value === null) return null;
  const result = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(result) ? result : null;
}

function rowFromRecord(record: AttendanceRecordData, employee: AttendanceEmployeeData, dateKey: string): AttendanceReportRow {
  return {
    key: `${employee.id}:${dateKey}`,
    attendanceId: record.id,
    userId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role,
    dateKey,
    status: record.status,
    checkInAt: record.checkInAt,
    note: record.note,
    hasPhoto: Boolean(record.photoPath),
    latitude: decimalToNumber(record.latitude),
    longitude: decimalToNumber(record.longitude),
    accuracyMeters: record.accuracyMeters,
    locationAt: record.locationAt,
    source: record.source,
    recordedByName: record.recordedBy?.name ?? null,
    correctedByName: record.correctedBy?.name ?? null,
    correctedAt: record.correctedAt,
    updatedAt: record.updatedAt,
    isDerived: false,
  };
}

export function resolveAttendanceRange(
  fromValue: string | undefined,
  toValue: string | undefined,
  today = jakartaDateKey(new Date()),
) {
  const requestedFrom = fromValue && isValidDateKey(fromValue) ? fromValue : "";
  const requestedTo = toValue && isValidDateKey(toValue) ? toValue : "";
  const to = requestedTo && requestedTo <= today ? requestedTo : today;
  let from = requestedFrom || `${to.slice(0, 7)}-01`;

  if (from > to) from = to;
  if (daysBetweenDateKeys(from, to) > ATTENDANCE_MAX_RANGE_DAYS - 1) {
    from = addDaysToDateKey(to, -(ATTENDANCE_MAX_RANGE_DAYS - 1));
  }

  return { from, to };
}

export function resolveAttendanceMonth(value: string | undefined, today = jakartaDateKey(new Date())) {
  const currentMonth = today.slice(0, 7);
  if (!value || !monthKeyRange(value)) return currentMonth;
  return value > currentMonth ? currentMonth : value;
}

export function buildAttendanceRows(input: {
  employees: AttendanceEmployeeData[];
  records: AttendanceRecordData[];
  holidays: AttendanceHolidayData[];
  settings: AttendanceSettings;
  from: string;
  to: string;
  today: string;
  userId?: string;
}) {
  const dates = eachDateKey(input.from, input.to, ATTENDANCE_MAX_RANGE_DAYS);
  if (dates.length === 0) return [] as AttendanceReportRow[];

  const workDays = new Set(input.settings.workDays);
  const holidayKeys = new Set(input.holidays.map((holiday) => utcDateToDateKey(holiday.date)));
  const attendanceStart = input.settings.startDate;
  const records = new Map(
    input.records.map((record) => [`${record.userId}:${utcDateToDateKey(record.date)}`, record]),
  );
  const employees = input.userId
    ? input.employees.filter((employee) => employee.id === input.userId)
    : input.employees;
  const rows: AttendanceReportRow[] = [];

  for (const employee of employees) {
    const employeeStart = jakartaDateKey(employee.createdAt);
    for (const dateKey of dates) {
      const record = records.get(`${employee.id}:${dateKey}`);
      if (record) {
        rows.push(rowFromRecord(record, employee, dateKey));
        continue;
      }

      // Hari yang belum terjadi tidak dibuatkan baris.
      if (dateKey > input.today) continue;
      // Pegawai nonaktif tidak ditambahkan alpha otomatis.
      if (!employee.isActive) continue;
      if (dateKey < employeeStart) continue;
      if (dateKey < attendanceStart) continue;
      if (!workDays.has(jakartaWeekday(dateKey))) continue;
      if (holidayKeys.has(dateKey)) continue;

      rows.push({
        key: `${employee.id}:${dateKey}`,
        attendanceId: null,
        userId: employee.id,
        employeeName: employee.name,
        employeeRole: employee.role,
        dateKey,
        status: dateKey === input.today ? "BELUM_ABSEN" : "ALPHA",
        checkInAt: null,
        note: null,
        hasPhoto: false,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationAt: null,
        source: null,
        recordedByName: null,
        correctedByName: null,
        correctedAt: null,
        updatedAt: null,
        isDerived: true,
      });
    }
  }

  return rows.sort((left, right) => {
    const dateOrder = right.dateKey.localeCompare(left.dateKey);
    if (dateOrder !== 0) return dateOrder;
    return left.employeeName.localeCompare(right.employeeName, "id");
  });
}

export function filterAttendanceRows(rows: AttendanceReportRow[], status: AttendanceStatusFilter) {
  if (status === "ALL") return rows;
  return rows.filter((row) => row.status === status);
}

export function summarizeAttendanceRows(rows: AttendanceReportRow[]): AttendanceReportSummary {
  const summary: AttendanceReportSummary = {
    total: rows.length,
    HADIR: 0,
    TERLAMBAT: 0,
    IZIN: 0,
    ALPHA: 0,
    BELUM_ABSEN: 0,
    attendanceRate: 0,
  };

  for (const row of rows) summary[row.status] += 1;

  const expected = summary.HADIR + summary.TERLAMBAT + summary.IZIN + summary.ALPHA;
  summary.attendanceRate = expected > 0 ? (summary.HADIR + summary.TERLAMBAT) / expected : 0;
  return summary;
}
