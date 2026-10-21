import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAttendanceRows,
  filterAttendanceRows,
  resolveAttendanceMonth,
  resolveAttendanceRange,
  summarizeAttendanceRows,
} from "../lib/attendance/report.ts";

const settings = {
  startDate: "2026-10-01",
  checkInTime: "08:00",
  lateToleranceMinutes: 15,
  workDays: [1, 2, 3, 4, 5, 6],
  version: 1,
};

function employee(overrides = {}) {
  return {
    id: "user-1",
    name: "Budi",
    role: "ADMIN_CUSTOMER",
    isActive: true,
    createdAt: new Date("2026-10-01T02:00:00.000Z"),
    ...overrides,
  };
}

function record(overrides = {}) {
  return {
    id: "attendance-1",
    userId: "user-1",
    date: new Date("2026-10-19T00:00:00.000Z"),
    status: "HADIR",
    checkInAt: new Date("2026-10-19T00:58:00.000Z"),
    note: null,
    photoPath: "user-1/2026/10/a.webp",
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationAt: null,
    source: "SELF",
    recordedById: null,
    correctedById: null,
    correctedAt: null,
    updatedAt: new Date("2026-10-19T01:00:00.000Z"),
    recordedBy: null,
    correctedBy: null,
    ...overrides,
  };
}

test("record eksplisit menang dan hari libur tidak menghasilkan Alpha", () => {
  const rows = buildAttendanceRows({
    employees: [employee()],
    records: [record()],
    holidays: [{ date: new Date("2026-10-20T00:00:00.000Z"), name: "Libur" }],
    settings,
    from: "2026-10-19",
    to: "2026-10-21",
    today: "2026-10-21",
  });

  assert.equal(rows.length, 2);
  const explicit = rows.find((row) => row.dateKey === "2026-10-19");
  assert.equal(explicit?.status, "HADIR");
  assert.equal(explicit?.isDerived, false);
  const todayRow = rows.find((row) => row.dateKey === "2026-10-21");
  assert.equal(todayRow?.status, "BELUM_ABSEN");
  assert.equal(todayRow?.isDerived, true);
});

test("hari kerja lewat tanpa record menjadi Alpha, sebelum akun dibuat tidak dihitung", () => {
  const rows = buildAttendanceRows({
    employees: [employee({ createdAt: new Date("2026-10-20T02:00:00.000Z") })],
    records: [],
    holidays: [],
    settings,
    from: "2026-10-19",
    to: "2026-10-21",
    today: "2026-10-21",
  });

  assert.deepEqual(rows.map((row) => row.dateKey), ["2026-10-21", "2026-10-20"]);
  assert.equal(rows[0].status, "BELUM_ABSEN");
  assert.equal(rows[1].status, "ALPHA");
});

test("hari sebelum tanggal mulai absensi tidak diturunkan menjadi Alpha", () => {
  const rows = buildAttendanceRows({
    employees: [employee()],
    records: [],
    holidays: [],
    settings: { ...settings, startDate: "2026-10-21" },
    from: "2026-10-19",
    to: "2026-10-21",
    today: "2026-10-21",
  });

  assert.deepEqual(rows.map((row) => row.dateKey), ["2026-10-21"]);
  assert.equal(rows[0].status, "BELUM_ABSEN");
});

test("record eksplisit di hari Minggu tetap ditampilkan, hari kerja tanpa record menjadi Alpha", () => {
  const rows = buildAttendanceRows({
    employees: [employee()],
    records: [record({ date: new Date("2026-10-25T00:00:00.000Z"), checkInAt: new Date("2026-10-25T01:00:00.000Z") })],
    holidays: [],
    settings,
    from: "2026-10-24",
    to: "2026-10-25",
    today: "2026-10-26",
  });

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.dateKey === "2026-10-24")?.status, "ALPHA");
  assert.equal(rows.find((row) => row.dateKey === "2026-10-25")?.status, "HADIR");
});

test("pegawai nonaktif tidak mendapat Alpha otomatis", () => {
  const rows = buildAttendanceRows({
    employees: [employee({ isActive: false })],
    records: [],
    holidays: [],
    settings,
    from: "2026-10-19",
    to: "2026-10-20",
    today: "2026-10-21",
  });

  assert.equal(rows.length, 0);
});

test("filter status dan ringkasan kehadiran dihitung dari baris", () => {
  const rows = buildAttendanceRows({
    employees: [employee()],
    records: [
      record({ id: "a", date: new Date("2026-10-19T00:00:00.000Z") }),
      record({ id: "b", date: new Date("2026-10-20T00:00:00.000Z"), status: "IZIN", checkInAt: null, note: "Sakit", photoPath: null, source: "OWNER" }),
    ],
    holidays: [],
    settings,
    from: "2026-10-19",
    to: "2026-10-21",
    today: "2026-10-21",
  });

  assert.equal(filterAttendanceRows(rows, "IZIN").length, 1);
  assert.equal(filterAttendanceRows(rows, "ALL").length, 3);
  const summary = summarizeAttendanceRows(rows);
  assert.equal(summary.HADIR, 1);
  assert.equal(summary.IZIN, 1);
  assert.equal(summary.BELUM_ABSEN, 1);
  assert.equal(summary.ALPHA, 0);
  assert.equal(summary.total, 3);
  assert.equal(summary.attendanceRate, 0.5);
});

test("rentang laporan dibatasi 366 hari dan bulan tidak boleh melewati bulan berjalan", () => {
  assert.deepEqual(resolveAttendanceRange(undefined, undefined, "2026-10-21"), {
    from: "2026-10-01",
    to: "2026-10-21",
  });
  assert.deepEqual(resolveAttendanceRange("2025-01-01", "2026-10-21", "2026-10-21"), {
    from: "2025-10-21",
    to: "2026-10-21",
  });
  assert.deepEqual(resolveAttendanceRange("2026-10-25", "2027-01-01", "2026-10-21"), {
    from: "2026-10-21",
    to: "2026-10-21",
  });
  assert.equal(resolveAttendanceMonth("2026-10", "2026-10-21"), "2026-10");
  assert.equal(resolveAttendanceMonth("2026-11", "2026-10-21"), "2026-10");
  assert.equal(resolveAttendanceMonth("", "2026-10-21"), "2026-10");
});
