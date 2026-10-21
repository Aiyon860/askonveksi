import assert from "node:assert/strict";
import test from "node:test";

import {
  attendanceHolidaySchema,
  attendanceSettingsSchema,
  correctionAttendanceSchema,
  manualAttendanceSchema,
  parseAttendanceLocation,
} from "../lib/attendance/validation.ts";

test("pengaturan absensi valid dan menolak hari kerja kosong/ganda", () => {
  const valid = attendanceSettingsSchema.safeParse({
    version: "1",
    startDate: "2026-10-21",
    checkInTime: "08:00",
    lateToleranceMinutes: "15",
    workDays: ["1", "2", "3", "4", "5", "6"],
  });
  assert.equal(valid.success, true);

  assert.equal(attendanceSettingsSchema.safeParse({
    version: "1",
    startDate: "2026-10-21",
    checkInTime: "08:00",
    lateToleranceMinutes: "15",
    workDays: [],
  }).success, false);

  assert.equal(attendanceSettingsSchema.safeParse({
    version: "1",
    startDate: "2026-10-21",
    checkInTime: "08:00",
    lateToleranceMinutes: "15",
    workDays: ["1", "1"],
  }).success, false);

  assert.equal(attendanceSettingsSchema.safeParse({
    version: "1",
    startDate: "2026-10-21",
    checkInTime: "25:00",
    lateToleranceMinutes: "15",
    workDays: ["1"],
  }).success, false);

  assert.equal(attendanceSettingsSchema.safeParse({
    version: "1",
    startDate: "2026-02-30",
    checkInTime: "08:00",
    lateToleranceMinutes: "15",
    workDays: ["1"],
  }).success, false);
});

test("absensi manual mewajibkan jam untuk Hadir/Terlambat dan keterangan untuk Izin", () => {
  const base = { userId: "cuid_pegawai_123", date: "2026-10-21" };
  assert.equal(manualAttendanceSchema.safeParse({
    ...base,
    status: "HADIR",
    time: "08:00",
  }).success, true);

  assert.equal(manualAttendanceSchema.safeParse({
    ...base,
    status: "HADIR",
    time: "",
  }).success, false);

  assert.equal(manualAttendanceSchema.safeParse({
    ...base,
    status: "IZIN",
    note: "Sakit",
  }).success, true);

  assert.equal(manualAttendanceSchema.safeParse({
    ...base,
    status: "IZIN",
    note: "",
  }).success, false);

  assert.equal(manualAttendanceSchema.safeParse({
    ...base,
    status: "ALPHA",
  }).success, true);
});

test("koreksi membutuhkan updatedAt berformat ISO dan tanggal libur valid", () => {
  assert.equal(correctionAttendanceSchema.safeParse({
    attendanceId: "cuid_absensi_123",
    updatedAt: new Date("2026-10-21T01:00:00.000Z").toISOString(),
    status: "ALPHA",
  }).success, true);

  assert.equal(correctionAttendanceSchema.safeParse({
    attendanceId: "cuid_absensi_123",
    updatedAt: "kemarin",
    status: "ALPHA",
  }).success, false);

  assert.equal(attendanceHolidaySchema.safeParse({ date: "2026-10-21", name: "Libur" }).success, true);
  assert.equal(attendanceHolidaySchema.safeParse({ date: "2026-02-30", name: "Libur" }).success, false);
  assert.equal(attendanceHolidaySchema.safeParse({ date: "2026-10-21", name: "" }).success, false);
});

test("lokasi opsional tetap absen bila GPS tidak tersedia", () => {
  assert.deepEqual(parseAttendanceLocation({
    latitude: null,
    longitude: null,
    accuracyMeters: null,
  }), { ok: true, location: null });

  const parsed = parseAttendanceLocation({
    latitude: "-6.2",
    longitude: "106.8",
    accuracyMeters: "12.4",
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.location, {
    latitude: -6.2,
    longitude: 106.8,
    accuracyMeters: 12,
  });

  assert.equal(parseAttendanceLocation({
    latitude: "91",
    longitude: "106",
    accuracyMeters: null,
  }).ok, false);
  assert.equal(parseAttendanceLocation({
    latitude: "-6",
    longitude: "",
    accuracyMeters: null,
  }).ok, false);
});
