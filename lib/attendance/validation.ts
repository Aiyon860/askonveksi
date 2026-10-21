import { z } from "zod";

import { ATTENDANCE_MAX_HOLIDAY_NAME_LENGTH, ATTENDANCE_MAX_NOTE_LENGTH, ATTENDANCE_STATUSES } from "./constants.ts";
import { isValidDateKey, isValidTimeKey } from "./time.ts";

const entityIdSchema = z.string().trim().min(10, "Data tidak valid.").max(40, "Data tidak valid.");
const dateKeySchema = z
  .string()
  .trim()
  .refine(isValidDateKey, "Tanggal tidak valid.");
const timeKeySchema = z
  .string()
  .trim()
  .refine(isValidTimeKey, "Jam tidak valid. Gunakan format HH:mm.");
const optionalTimeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  timeKeySchema.optional(),
);
const optionalNoteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(ATTENDANCE_MAX_NOTE_LENGTH, `Keterangan maksimal ${ATTENDANCE_MAX_NOTE_LENGTH} karakter.`).optional(),
);

export const attendanceSettingsSchema = z.object({
  version: z.coerce.number().int().positive("Versi pengaturan tidak valid."),
  startDate: dateKeySchema,
  checkInTime: timeKeySchema,
  lateToleranceMinutes: z.coerce
    .number()
    .int()
    .min(0, "Toleransi minimal 0 menit.")
    .max(180, "Toleransi maksimal 180 menit."),
  workDays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Pilih minimal satu hari kerja.")
    .refine((values) => new Set(values).size === values.length, "Hari kerja tidak boleh ganda."),
});

const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

export const manualAttendanceSchema = z
  .object({
    userId: entityIdSchema,
    date: dateKeySchema,
    status: attendanceStatusSchema,
    time: optionalTimeSchema,
    note: optionalNoteSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "HADIR" || value.status === "TERLAMBAT") {
      if (!value.time) {
        context.addIssue({
          code: "custom",
          path: ["time"],
          message: "Jam masuk wajib diisi untuk status Hadir/Terlambat.",
        });
      }
    }
    if (value.status === "IZIN" && !value.note) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Keterangan izin wajib diisi.",
      });
    }
  });

export const correctionAttendanceSchema = z
  .object({
    attendanceId: entityIdSchema,
    updatedAt: z.string().datetime("Data absensi sudah berubah. Muat ulang halaman."),
    status: attendanceStatusSchema,
    time: optionalTimeSchema,
    note: optionalNoteSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "HADIR" || value.status === "TERLAMBAT") {
      if (!value.time) {
        context.addIssue({
          code: "custom",
          path: ["time"],
          message: "Jam masuk wajib diisi untuk status Hadir/Terlambat.",
        });
      }
    }
    if (value.status === "IZIN" && !value.note) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Keterangan izin wajib diisi.",
      });
    }
  });

export const deleteManualAttendanceSchema = z.object({
  attendanceId: entityIdSchema,
  updatedAt: z.string().datetime("Data absensi sudah berubah. Muat ulang halaman."),
});

export const attendanceHolidaySchema = z.object({
  date: dateKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Nama hari libur minimal 2 karakter.")
    .max(ATTENDANCE_MAX_HOLIDAY_NAME_LENGTH, `Nama hari libur maksimal ${ATTENDANCE_MAX_HOLIDAY_NAME_LENGTH} karakter.`),
});

export const attendanceHolidayDeleteSchema = z.object({
  holidayId: entityIdSchema,
});

export type ParsedAttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

export function parseAttendanceLocation(input: {
  latitude: FormDataEntryValue | null;
  longitude: FormDataEntryValue | null;
  accuracyMeters: FormDataEntryValue | null;
}): { ok: true; location: ParsedAttendanceLocation | null } | { ok: false; message: string } {
  const latitudeRaw = typeof input.latitude === "string" ? input.latitude.trim() : "";
  const longitudeRaw = typeof input.longitude === "string" ? input.longitude.trim() : "";
  const accuracyRaw = typeof input.accuracyMeters === "string" ? input.accuracyMeters.trim() : "";

  if (!latitudeRaw && !longitudeRaw) return { ok: true, location: null };
  if (!latitudeRaw || !longitudeRaw) {
    return { ok: false, message: "Data lokasi tidak lengkap." };
  }

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, message: "Koordinat lokasi tidak valid." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: "Koordinat lokasi tidak valid." };
  }

  let accuracyMeters: number | null = null;
  if (accuracyRaw) {
    const parsed = Number(accuracyRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000) {
      return { ok: false, message: "Akurasi lokasi tidak valid." };
    }
    accuracyMeters = Math.round(parsed);
  }

  return {
    ok: true,
    location: { latitude, longitude, accuracyMeters },
  };
}

export function firstAttendanceValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
}
