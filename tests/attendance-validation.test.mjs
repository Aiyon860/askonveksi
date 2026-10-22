import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("migrasi absensi aman dijalankan ulang tanpa transaksi sendiri", async () => {
  const files = [
    "../prisma/migrations/20261022010000_attendance/migration.sql",
    "../prisma/migrations/20261022020000_attendance_start_date/migration.sql",
  ];

  for (const file of files) {
    const sql = await readFile(new URL(file, import.meta.url), "utf8");
    const statements = sql.replace(/--.*$/gm, "");

    // Prisma sudah membungkus tiap migrasi dalam satu transaksi. BEGIN/COMMIT
    // di dalam file membuat kegagalan parsial ter-commit dan retry deploy
    // berujung "current transaction is aborted".
    assert.doesNotMatch(statements, /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im, file);

    // Harus idempotent supaya deploy tetap jalan kalau object sudah ada
    // (mis. schema pernah di-push manual ke database produksi).
    for (const create of statements.matchAll(/CREATE (?:UNIQUE )?(?:TABLE|INDEX)[^;]*;/gi)) {
      assert.match(create[0], /IF NOT EXISTS/i, `${file}: ${create[0].slice(0, 60)}`);
    }

    for (const addColumn of statements.matchAll(/ADD COLUMN[^,;]*/gi)) {
      assert.match(addColumn[0], /ADD COLUMN IF NOT EXISTS/i, `${file}: ${addColumn[0]}`);
    }

    if (/CREATE TYPE/i.test(statements)) {
      assert.match(statements, /FROM pg_type[\s\S]*CREATE TYPE/i, file);
    }
  }
});
