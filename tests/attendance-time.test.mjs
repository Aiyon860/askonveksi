import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysToDateKey,
  daysBetweenDateKeys,
  eachDateKey,
  formatAttendanceMonth,
  isValidDateKey,
  isValidTimeKey,
  jakartaDateKey,
  jakartaDateTimeToUtc,
  jakartaMinutesOfDay,
  jakartaTimeKey,
  jakartaWeekday,
  monthKeyRange,
  shiftMonthKey,
} from "../lib/attendance/time.ts";
import { resolveCheckInStatus } from "../lib/attendance/status.ts";

test("tanggal dan jam Jakarta memakai offset WIB", () => {
  const instant = new Date("2026-10-21T17:05:00.000Z");
  assert.equal(jakartaDateKey(instant), "2026-10-22");
  assert.equal(jakartaTimeKey(instant), "00:05");
  assert.equal(jakartaMinutesOfDay(instant), 5);
});

test("validasi tanggal dan jam menolak nilai tidak nyata", () => {
  assert.equal(isValidDateKey("2026-10-21"), true);
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2026-02-29"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
  assert.equal(isValidDateKey("21-10-2026"), false);
  assert.equal(isValidDateKey("0000-01-01"), false);
  assert.equal(isValidTimeKey("08:15"), true);
  assert.equal(isValidTimeKey("24:00"), false);
  assert.equal(isValidTimeKey("8:15"), false);
});

test("tanggal + jam WIB dikonversi ke instant UTC", () => {
  assert.equal(
    jakartaDateTimeToUtc("2026-10-21", "08:15")?.toISOString(),
    "2026-10-21T01:15:00.000Z",
  );
  assert.equal(jakartaDateTimeToUtc("2026-02-30", "08:00"), null);
  assert.equal(jakartaDateTimeToUtc("2026-10-21", "25:00"), null);
});

test("hari ISO dan rentang bulan dihitung benar", () => {
  assert.equal(jakartaWeekday("2026-10-19"), 1);
  assert.equal(jakartaWeekday("2026-10-25"), 7);
  assert.deepEqual(monthKeyRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(monthKeyRange("2026-10"), { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(monthKeyRange("2026-13"), null);
  assert.equal(monthKeyRange("0000-01"), null);
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(formatAttendanceMonth("2026-10"), "Oktober 2026");
});

test("penambahan hari dan irisan tanggal aman di batas bulan", () => {
  assert.equal(addDaysToDateKey("2026-10-31", 1), "2026-11-01");
  assert.equal(addDaysToDateKey("2026-10-01", -1), "2026-09-30");
  assert.equal(daysBetweenDateKeys("2026-10-19", "2026-10-21"), 2);
  assert.deepEqual(eachDateKey("2026-10-19", "2026-10-21"), ["2026-10-19", "2026-10-20", "2026-10-21"]);
  assert.equal(eachDateKey("2026-10-19", "2026-10-21", 2).length, 0);
});

test("status Hadir/Terlambat memakai toleransi menit penuh", () => {
  const base = {
    checkInTime: "08:00",
    lateToleranceMinutes: 15,
  };
  assert.equal(resolveCheckInStatus({ ...base, checkInAt: new Date("2026-10-21T00:59:59.000Z") }), "HADIR");
  assert.equal(resolveCheckInStatus({ ...base, checkInAt: new Date("2026-10-21T01:00:00.000Z") }), "HADIR");
  assert.equal(resolveCheckInStatus({ ...base, checkInAt: new Date("2026-10-21T01:15:59.000Z") }), "HADIR");
  assert.equal(resolveCheckInStatus({ ...base, checkInAt: new Date("2026-10-21T01:16:00.000Z") }), "TERLAMBAT");
});
