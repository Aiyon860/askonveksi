"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  flashMessagePath,
  messageForError,
  runRedirectingAction,
  UserFacingError,
} from "@/lib/actions/response";
import { ATTENDANCE_ADMIN_ROLES, isAttendanceEmployee } from "@/lib/auth/permissions";
import { getCurrentActor, requireActor } from "@/lib/auth/session";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/attendance/constants";
import { getAttendanceSettings } from "@/lib/attendance/data";
import {
  AttendancePhotoError,
  deleteAttendancePhoto,
  optimizeAttendancePhoto,
  saveAttendancePhoto,
} from "@/lib/attendance/photo";
import { resolveCheckInStatus } from "@/lib/attendance/status";
import {
  dateKeyToUtcDate,
  formatAttendanceDateShort,
  jakartaDateKey,
  jakartaDateTimeToUtc,
  jakartaTimeKey,
  utcDateToDateKey,
} from "@/lib/attendance/time";
import type { ClockInState } from "@/lib/attendance/types";
import {
  attendanceHolidayDeleteSchema,
  attendanceHolidaySchema,
  attendanceSettingsSchema,
  correctionAttendanceSchema,
  deleteManualAttendanceSchema,
  firstAttendanceValidationMessage,
  manualAttendanceSchema,
  parseAttendanceLocation,
} from "@/lib/attendance/validation";
import { getPrismaClient } from "@/lib/prisma";

const ATTENDANCE_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

const ATTENDANCE_REPORT_PATH = "/absensi/laporan";
const ATTENDANCE_SETTINGS_PATH = "/settings#absensi";

function attendanceReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 3_000) return ATTENDANCE_REPORT_PATH;

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || url.pathname !== ATTENDANCE_REPORT_PATH) {
      return ATTENDANCE_REPORT_PATH;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return ATTENDANCE_REPORT_PATH;
  }
}

function revalidateAttendance() {
  revalidatePath("/absensi");
  revalidatePath(ATTENDANCE_REPORT_PATH);
}

function revalidateAttendanceSettings() {
  revalidatePath("/settings");
  revalidateAttendance();
}

async function getEmployeeTarget(userId: string) {
  const target = await getPrismaClient().appUser.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true, createdAt: true },
  });
  if (!target || !isAttendanceEmployee(target.role)) {
    throw new UserFacingError("Pegawai tidak ditemukan.");
  }
  return target;
}

/**
 * Absen mandiri dari kamera. State dikembalikan (bukan redirect) supaya dialog
 * bisa menampilkan hasil Hadir/Terlambat tanpa memuat ulang halaman.
 */
export async function clockInAction(_previous: ClockInState, formData: FormData): Promise<ClockInState> {
  try {
    const actor = await getCurrentActor();
    if (!actor) {
      return { ok: false, message: "Sesi Anda berakhir. Masuk kembali lalu coba lagi." };
    }
    if (!isAttendanceEmployee(actor.role)) {
      return { ok: false, message: "Akun Owner/Developer tidak memiliki absensi pegawai." };
    }

    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return { ok: false, message: "Ambil foto terlebih dahulu." };
    }

    const parsedLocation = parseAttendanceLocation({
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      accuracyMeters: formData.get("accuracyMeters"),
    });
    if (!parsedLocation.ok) return { ok: false, message: parsedLocation.message };

    const now = new Date();
    const dateKey = jakartaDateKey(now);
    const date = dateKeyToUtcDate(dateKey);
    if (!date) return { ok: false, message: "Tanggal absensi tidak valid." };

    const prisma = getPrismaClient();
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: actor.id, date } },
      select: { status: true },
    });
    if (existing) {
      return {
        ok: false,
        message: `Anda sudah tercatat ${ATTENDANCE_STATUS_LABEL[existing.status]} hari ini.`,
      };
    }

    const settings = await getAttendanceSettings();
    const status = resolveCheckInStatus({
      checkInAt: now,
      checkInTime: settings.checkInTime,
      lateToleranceMinutes: settings.lateToleranceMinutes,
    });

    const optimized = await optimizeAttendancePhoto(photo);
    let photoPath: string;
    try {
      photoPath = await saveAttendancePhoto({
        userId: actor.id,
        dateKey,
        bytes: optimized.bytes,
      });
    } catch (error) {
      console.error("[attendance:save-photo]", error);
      throw new UserFacingError("Foto absensi tidak dapat disimpan. Hubungi Owner.");
    }

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            userId: actor.id,
            date,
            status,
            checkInAt: now,
            photoPath,
            photoMimeType: optimized.mimeType,
            photoSize: optimized.size,
            latitude: parsedLocation.location
              ? new Prisma.Decimal(parsedLocation.location.latitude.toFixed(6))
              : null,
            longitude: parsedLocation.location
              ? new Prisma.Decimal(parsedLocation.location.longitude.toFixed(6))
              : null,
            accuracyMeters: parsedLocation.location?.accuracyMeters ?? null,
            locationAt: parsedLocation.location ? now : null,
            source: "SELF",
          },
          select: { id: true },
        });

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "Attendance",
            entityId: created.id,
            action: "ATTENDANCE_CLOCKED_IN",
            changedFields: ["status", "checkInAt", "photoPath", "latitude", "longitude"],
            metadata: {
              date: dateKey,
              status,
              time: jakartaTimeKey(now),
              hasLocation: Boolean(parsedLocation.location),
              accuracyMeters: parsedLocation.location?.accuracyMeters ?? null,
            },
          },
        });
      }, ATTENDANCE_TRANSACTION_OPTIONS);
    } catch (error) {
      await deleteAttendancePhoto(photoPath);
      throw error;
    }

    revalidateAttendance();
    const time = jakartaTimeKey(now);
    return {
      ok: true,
      message: status === "HADIR"
        ? `Absensi tercatat: Hadir pukul ${time} WIB.`
        : `Absensi tercatat: Terlambat pukul ${time} WIB.`,
      status,
      time,
      dateKey,
    };
  } catch (error) {
    if (
      error instanceof AttendancePhotoError
      || error instanceof UserFacingError
      || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      return {
        ok: false,
        message: error instanceof Prisma.PrismaClientKnownRequestError
          ? "Anda sudah absen hari ini."
          : error.message,
      };
    }
    console.error("[attendance:clock-in]", error);
    return { ok: false, message: messageForError(error) };
  }
}

export async function createManualAttendanceAction(formData: FormData) {
  const returnTo = attendanceReturnPath(formData.get("returnTo"));
  return runRedirectingAction(returnTo, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = manualAttendanceSchema.safeParse({
      userId: formData.get("userId"),
      date: formData.get("date"),
      status: formData.get("status"),
      time: formData.get("time"),
      note: formData.get("note"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));

    const target = await getEmployeeTarget(parsed.data.userId);
    if (!target.isActive) throw new UserFacingError("Pegawai sudah nonaktif. Aktifkan kembali sebelum mencatat absensi.");
    const today = jakartaDateKey(new Date());
    if (parsed.data.date > today) throw new UserFacingError("Tanggal absensi tidak boleh melewati hari ini.");
    if (parsed.data.date < jakartaDateKey(target.createdAt)) {
      throw new UserFacingError("Tanggal absensi tidak boleh sebelum akun pegawai dibuat.");
    }

    const date = dateKeyToUtcDate(parsed.data.date);
    if (!date) throw new UserFacingError("Tanggal absensi tidak valid.");
    const checkInAt = ["HADIR", "TERLAMBAT"].includes(parsed.data.status)
      ? jakartaDateTimeToUtc(parsed.data.date, parsed.data.time ?? "")
      : null;
    if (["HADIR", "TERLAMBAT"].includes(parsed.data.status) && !checkInAt) {
      throw new UserFacingError("Jam masuk tidak valid.");
    }
    const note = parsed.data.note ?? null;
    const prisma = getPrismaClient();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: target.id, date } },
      select: { id: true },
    });
    if (existing) {
      throw new UserFacingError("Absensi pegawai pada tanggal tersebut sudah ada. Gunakan koreksi.");
    }

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            userId: target.id,
            date,
            status: parsed.data.status,
            checkInAt,
            note,
            source: "OWNER",
            recordedById: actor.id,
          },
          select: { id: true },
        });

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "Attendance",
            entityId: created.id,
            action: "ATTENDANCE_MANUAL_RECORDED",
            changedFields: ["status", "checkInAt", "note", "source"],
            metadata: {
              userId: target.id,
              date: parsed.data.date,
              status: parsed.data.status,
              time: parsed.data.time ?? null,
              hasNote: Boolean(note),
            },
          },
        });
      }, ATTENDANCE_TRANSACTION_OPTIONS);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new UserFacingError("Absensi pegawai pada tanggal tersebut sudah ada. Gunakan koreksi.");
      }
      throw error;
    }

    revalidateAttendance();
    return flashMessagePath(
      returnTo,
      "notice",
      `Absensi ${target.name} tanggal ${formatAttendanceDateShort(parsed.data.date)} dicatat.`,
    );
  });
}

export async function correctAttendanceAction(formData: FormData) {
  const returnTo = attendanceReturnPath(formData.get("returnTo"));
  return runRedirectingAction(returnTo, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = correctionAttendanceSchema.safeParse({
      attendanceId: formData.get("attendanceId"),
      updatedAt: formData.get("updatedAt"),
      status: formData.get("status"),
      time: formData.get("time"),
      note: formData.get("note"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const current = await prisma.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: {
        id: true,
        userId: true,
        date: true,
        status: true,
        checkInAt: true,
        note: true,
        updatedAt: true,
        user: { select: { name: true, role: true } },
      },
    });
    if (!current) throw new UserFacingError("Absensi tidak ditemukan.");
    if (!isAttendanceEmployee(current.user.role)) {
      throw new UserFacingError("Absensi ini bukan milik pegawai.");
    }
    if (current.updatedAt.toISOString() !== parsed.data.updatedAt) {
      throw new UserFacingError("Absensi sudah berubah. Muat ulang halaman lalu coba lagi.");
    }

    const dateKey = utcDateToDateKey(current.date);
    const checkInAt = ["HADIR", "TERLAMBAT"].includes(parsed.data.status)
      ? jakartaDateTimeToUtc(dateKey, parsed.data.time ?? "")
      : null;
    if (["HADIR", "TERLAMBAT"].includes(parsed.data.status) && !checkInAt) {
      throw new UserFacingError("Jam masuk tidak valid.");
    }
    const note = parsed.data.note ?? null;
    const changedFields: string[] = [];
    if (current.status !== parsed.data.status) changedFields.push("status");
    if ((current.checkInAt?.getTime() ?? null) !== (checkInAt?.getTime() ?? null)) changedFields.push("checkInAt");
    if ((current.note ?? null) !== note) changedFields.push("note");

    const correctedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: {
          status: parsed.data.status,
          checkInAt,
          note,
          correctedById: actor.id,
          correctedAt,
        },
      });
      if (!updated.count) {
        throw new UserFacingError("Absensi sudah berubah. Muat ulang halaman lalu coba lagi.");
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "Attendance",
          entityId: current.id,
          action: "ATTENDANCE_CORRECTED",
          changedFields: changedFields.length ? changedFields : ["correctedAt"],
          metadata: {
            userId: current.userId,
            date: dateKey,
            before: {
              status: current.status,
              checkInAt: current.checkInAt?.toISOString() ?? null,
              hasNote: Boolean(current.note),
            },
            after: {
              status: parsed.data.status,
              checkInAt: checkInAt?.toISOString() ?? null,
              hasNote: Boolean(note),
            },
          },
        },
      });
    }, ATTENDANCE_TRANSACTION_OPTIONS);

    revalidateAttendance();
    return flashMessagePath(
      returnTo,
      "notice",
      `Absensi ${current.user.name} tanggal ${formatAttendanceDateShort(dateKey)} dikoreksi.`,
    );
  });
}

export async function deleteManualAttendanceAction(formData: FormData) {
  const returnTo = attendanceReturnPath(formData.get("returnTo"));
  return runRedirectingAction(returnTo, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = deleteManualAttendanceSchema.safeParse({
      attendanceId: formData.get("attendanceId"),
      updatedAt: formData.get("updatedAt"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const current = await prisma.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: {
        id: true,
        userId: true,
        date: true,
        status: true,
        checkInAt: true,
        note: true,
        photoPath: true,
        source: true,
        updatedAt: true,
        user: { select: { name: true, role: true } },
      },
    });
    if (!current) throw new UserFacingError("Absensi tidak ditemukan.");
    if (!isAttendanceEmployee(current.user.role)) {
      throw new UserFacingError("Absensi ini bukan milik pegawai.");
    }
    if (current.source !== "OWNER") {
      throw new UserFacingError("Absensi mandiri tidak dapat dihapus. Gunakan koreksi.");
    }
    if (current.updatedAt.toISOString() !== parsed.data.updatedAt) {
      throw new UserFacingError("Absensi sudah berubah. Muat ulang halaman lalu coba lagi.");
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.attendance.deleteMany({
        where: { id: current.id, updatedAt: current.updatedAt },
      });
      if (!deleted.count) {
        throw new UserFacingError("Absensi sudah berubah. Muat ulang halaman lalu coba lagi.");
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "Attendance",
          entityId: current.id,
          action: "ATTENDANCE_MANUAL_DELETED",
          changedFields: ["deleted"],
          metadata: {
            userId: current.userId,
            employeeName: current.user.name,
            date: utcDateToDateKey(current.date),
            status: current.status,
            checkInAt: current.checkInAt?.toISOString() ?? null,
            hasNote: Boolean(current.note),
          },
        },
      });
    }, ATTENDANCE_TRANSACTION_OPTIONS);

    if (current.photoPath) await deleteAttendancePhoto(current.photoPath);
    revalidateAttendance();
    return flashMessagePath(
      returnTo,
      "notice",
      `Absensi manual ${current.user.name} tanggal ${formatAttendanceDateShort(utcDateToDateKey(current.date))} dihapus.`,
    );
  });
}

export async function updateAttendanceSettingsAction(formData: FormData) {
  return runRedirectingAction(ATTENDANCE_SETTINGS_PATH, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = attendanceSettingsSchema.safeParse({
      version: formData.get("version"),
      startDate: formData.get("startDate"),
      checkInTime: formData.get("checkInTime"),
      lateToleranceMinutes: formData.get("lateToleranceMinutes"),
      workDays: formData.getAll("workDays"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));
    if (parsed.data.startDate > jakartaDateKey(new Date())) {
      throw new UserFacingError("Tanggal mulai absensi tidak boleh melewati hari ini.");
    }
    const startDate = dateKeyToUtcDate(parsed.data.startDate);
    if (!startDate) throw new UserFacingError("Tanggal mulai absensi tidak valid.");

    const workDays = [...parsed.data.workDays].sort((left, right) => left - right);
    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.businessProfile.updateMany({
        where: { id: "default", version: parsed.data.version },
        data: {
          attendanceStartDate: startDate,
          attendanceCheckInTime: parsed.data.checkInTime,
          attendanceLateToleranceMin: parsed.data.lateToleranceMinutes,
          attendanceWorkDays: workDays,
          version: { increment: 1 },
        },
      });
      if (!updated.count) {
        throw new UserFacingError("Pengaturan sudah berubah. Muat ulang halaman.");
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "AttendanceSetting",
          entityId: "default",
          action: "ATTENDANCE_SETTINGS_UPDATED",
          changedFields: ["attendanceStartDate", "attendanceCheckInTime", "attendanceLateToleranceMin", "attendanceWorkDays"],
          metadata: {
            startDate: parsed.data.startDate,
            checkInTime: parsed.data.checkInTime,
            lateToleranceMinutes: parsed.data.lateToleranceMinutes,
            workDays,
          },
        },
      });
    }, ATTENDANCE_TRANSACTION_OPTIONS);

    revalidateAttendanceSettings();
    return flashMessagePath(ATTENDANCE_SETTINGS_PATH, "notice", "Pengaturan absensi disimpan.");
  });
}

export async function createAttendanceHolidayAction(formData: FormData) {
  return runRedirectingAction(ATTENDANCE_SETTINGS_PATH, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = attendanceHolidaySchema.safeParse({
      date: formData.get("date"),
      name: formData.get("name"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));

    const date = dateKeyToUtcDate(parsed.data.date);
    if (!date) throw new UserFacingError("Tanggal libur tidak valid.");
    const prisma = getPrismaClient();

    const existing = await prisma.attendanceHoliday.findUnique({
      where: { date },
      select: { id: true },
    });
    if (existing) throw new UserFacingError("Tanggal tersebut sudah terdaftar sebagai hari libur.");

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.attendanceHoliday.create({
          data: { date, name: parsed.data.name },
          select: { id: true },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "AttendanceHoliday",
            entityId: created.id,
            action: "ATTENDANCE_HOLIDAY_CREATED",
            changedFields: ["date", "name"],
            metadata: { date: parsed.data.date, name: parsed.data.name },
          },
        });
      }, ATTENDANCE_TRANSACTION_OPTIONS);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new UserFacingError("Tanggal tersebut sudah terdaftar sebagai hari libur.");
      }
      throw error;
    }

    revalidateAttendanceSettings();
    return flashMessagePath(
      ATTENDANCE_SETTINGS_PATH,
      "notice",
      `Hari libur ${formatAttendanceDateShort(parsed.data.date)} ditambahkan.`,
    );
  });
}

export async function deleteAttendanceHolidayAction(formData: FormData) {
  return runRedirectingAction(ATTENDANCE_SETTINGS_PATH, async () => {
    const actor = await requireActor(ATTENDANCE_ADMIN_ROLES);
    const parsed = attendanceHolidayDeleteSchema.safeParse({
      holidayId: formData.get("holidayId"),
    });
    if (!parsed.success) throw new UserFacingError(firstAttendanceValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const holiday = await prisma.attendanceHoliday.findUnique({
      where: { id: parsed.data.holidayId },
      select: { id: true, date: true, name: true },
    });
    if (!holiday) throw new UserFacingError("Hari libur tidak ditemukan.");

    await prisma.$transaction(async (tx) => {
      await tx.attendanceHoliday.delete({ where: { id: holiday.id } });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "AttendanceHoliday",
          entityId: holiday.id,
          action: "ATTENDANCE_HOLIDAY_DELETED",
          changedFields: ["deleted"],
          metadata: { date: utcDateToDateKey(holiday.date), name: holiday.name },
        },
      });
    }, ATTENDANCE_TRANSACTION_OPTIONS);

    revalidateAttendanceSettings();
    return flashMessagePath(ATTENDANCE_SETTINGS_PATH, "notice", "Hari libur dihapus.");
  });
}
