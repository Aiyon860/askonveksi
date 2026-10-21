import { ATTENDANCE_ADMIN_ROLES, hasRole, isAttendanceEmployee } from "@/lib/auth/permissions";
import { getCurrentActor, requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { ALL_PAGE_SIZE, paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

import {
  ATTENDANCE_REPORT_STATUSES,
  type AttendanceStatusFilter,
} from "./constants.ts";
import {
  buildAttendanceRows,
  filterAttendanceRows,
  resolveAttendanceMonth,
  resolveAttendanceRange,
  summarizeAttendanceRows,
} from "./report.ts";
import type { AttendanceEmployeeOption, AttendanceSettings } from "./types.ts";
import { dateKeyToUtcDate, jakartaDateKey, monthKeyRange, utcDateToDateKey } from "./time.ts";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatusFilter(value: string | string[] | undefined): AttendanceStatusFilter {
  const raw = first(value)?.trim() ?? "";
  return (ATTENDANCE_REPORT_STATUSES as readonly string[]).includes(raw)
    ? (raw as AttendanceStatusFilter)
    : "ALL";
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const profile = await getPrismaClient().businessProfile.findUniqueOrThrow({
    where: { id: "default" },
    select: {
      attendanceStartDate: true,
      attendanceCheckInTime: true,
      attendanceLateToleranceMin: true,
      attendanceWorkDays: true,
      version: true,
    },
  });

  return {
    startDate: utcDateToDateKey(profile.attendanceStartDate),
    checkInTime: profile.attendanceCheckInTime,
    lateToleranceMinutes: profile.attendanceLateToleranceMin,
    workDays: [...profile.attendanceWorkDays].sort((left, right) => left - right),
    version: profile.version,
  };
}

export async function getAttendanceHolidays() {
  await requireActor(ATTENDANCE_ADMIN_ROLES);
  return getPrismaClient().attendanceHoliday.findMany({
    orderBy: { date: "asc" },
    take: 500,
    select: { id: true, date: true, name: true },
  });
}

export async function getAttendanceHoliday(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return null;
  return getPrismaClient().attendanceHoliday.findUnique({
    where: { date },
    select: { id: true, date: true, name: true },
  });
}

export async function getAttendanceEmployeeOptions(): Promise<AttendanceEmployeeOption[]> {
  await requireActor(ATTENDANCE_ADMIN_ROLES);
  return getPrismaClient().appUser.findMany({
    where: {
      isActive: true,
      role: { notIn: ["OWNER", "DEVELOPER"] },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, isActive: true },
  });
}

export async function getAttendanceToday(userId: string, dateKey: string) {
  const actor = await getCurrentActor();
  if (!actor || (actor.id !== userId && !hasRole(actor.role, ATTENDANCE_ADMIN_ROLES))) {
    throw new Error("UNAUTHORIZED");
  }

  const date = dateKeyToUtcDate(dateKey);
  if (!date) throw new Error("INVALID_ATTENDANCE_DATE");

  const prisma = getPrismaClient();
  const [settings, holiday, record] = await Promise.all([
    getAttendanceSettings(),
    prisma.attendanceHoliday.findUnique({
      where: { date },
      select: { id: true, date: true, name: true },
    }),
    prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
      include: {
        recordedBy: { select: { name: true } },
        correctedBy: { select: { name: true } },
      },
    }),
  ]);

  return { settings, holiday, record };
}

export async function getAttendanceHistory(input: {
  userId: string;
  month?: string;
}) {
  const actor = await getCurrentActor();
  if (!actor || (actor.id !== input.userId && !hasRole(actor.role, ATTENDANCE_ADMIN_ROLES))) {
    throw new Error("UNAUTHORIZED");
  }

  const today = jakartaDateKey(new Date());
  const month = resolveAttendanceMonth(input.month, today);
  const range = monthKeyRange(month);
  if (!range) throw new Error("INVALID_ATTENDANCE_MONTH");

  const prisma = getPrismaClient();
  const [employee, settings, holidays] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    }),
    getAttendanceSettings(),
    prisma.attendanceHoliday.findMany({
      where: {
        date: {
          gte: dateKeyToUtcDate(range.from)!,
          lte: dateKeyToUtcDate(range.to)!,
        },
      },
      select: { date: true, name: true },
    }),
  ]);

  if (!employee || !isAttendanceEmployee(employee.role)) {
    return { month, employee: null, rows: [], holidays, settings };
  }

  const records = await prisma.attendance.findMany({
    where: {
      userId: input.userId,
      date: {
        gte: dateKeyToUtcDate(range.from)!,
        lte: dateKeyToUtcDate(range.to)!,
      },
    },
    include: {
      recordedBy: { select: { name: true } },
      correctedBy: { select: { name: true } },
    },
  });

  const rows = buildAttendanceRows({
    employees: [employee],
    records,
    holidays,
    settings,
    from: range.from,
    to: range.to,
    today,
  });

  return { month, employee, rows, holidays, settings };
}

export type AttendanceReportFilters = {
  from?: string | string[];
  to?: string | string[];
  userId?: string | string[];
  status?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

export async function getAttendanceReport(
  filters: AttendanceReportFilters,
  options: { paginate?: boolean } = {},
) {
  await requireActor(ATTENDANCE_ADMIN_ROLES);

  const prisma = getPrismaClient();
  const today = jakartaDateKey(new Date());
  const requestedFrom = first(filters.from)?.trim();
  const baseRange = resolveAttendanceRange(requestedFrom, first(filters.to)?.trim(), today);
  const status = parseStatusFilter(filters.status);
  const requestedUserId = first(filters.userId)?.trim() ?? "";

  const [employees, settings] = await Promise.all([
    prisma.appUser.findMany({
      where: { role: { notIn: ["OWNER", "DEVELOPER"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    }),
    getAttendanceSettings(),
  ]);

  // Tanpa filter tanggal eksplisit, mulai laporan dari tanggal fitur absensi
  // diaktifkan agar periode simulasi tidak dipenuhi Alpha historis.
  const range = !requestedFrom
    && settings.startDate > baseRange.from
    && settings.startDate <= baseRange.to
    ? { from: settings.startDate, to: baseRange.to }
    : baseRange;
  const selectedUserId = requestedUserId && employees.some((employee) => employee.id === requestedUserId)
    ? requestedUserId
    : "";
  const reportEmployees = selectedUserId
    ? employees.filter((employee) => employee.id === selectedUserId)
    : employees;
  const fromDate = dateKeyToUtcDate(range.from);
  const toDate = dateKeyToUtcDate(range.to);
  if (!fromDate || !toDate) throw new Error("INVALID_ATTENDANCE_RANGE");

  const [holidays, records] = await Promise.all([
    prisma.attendanceHoliday.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { date: true, name: true },
    }),
    prisma.attendance.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        ...(selectedUserId ? { userId: selectedUserId } : {}),
      },
      include: {
        recordedBy: { select: { name: true } },
        correctedBy: { select: { name: true } },
      },
    }),
  ]);

  const allRows = buildAttendanceRows({
    employees: reportEmployees,
    records,
    holidays,
    settings,
    from: range.from,
    to: range.to,
    today,
  });
  const summary = summarizeAttendanceRows(allRows);
  const filteredRows = filterAttendanceRows(allRows, status);
  const page = options.paginate === false ? 1 : parsePageParam(filters.page);
  const pageSize = options.paginate === false ? ALL_PAGE_SIZE : parsePageSizeParam(filters.pageSize);
  const pagination = paginate(filteredRows, page, pageSize);

  return {
    range,
    today,
    status,
    selectedUserId,
    employees,
    settings,
    summary,
    rows: pagination.items,
    total: pagination.total,
    page: pagination.page,
    pageCount: pagination.pageCount,
  };
}

export async function getAttendancePhotoRecord(id: string) {
  return getPrismaClient().attendance.findUnique({
    where: { id },
    select: { id: true, userId: true, photoPath: true, photoMimeType: true },
  });
}

