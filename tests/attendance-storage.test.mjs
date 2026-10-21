import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const uploadDir = await mkdtemp(join(tmpdir(), "askonveksi-attendance-"));
process.env.ATTENDANCE_UPLOAD_DIR = uploadDir;

const {
  AttendancePhotoError,
  attendancePhotoRelativePath,
  deleteAttendancePhoto,
  optimizeAttendancePhoto,
  readAttendancePhoto,
  resolveAttendancePhoto,
  resolveAttendancePhotoPath,
  saveAttendancePhoto,
} = await import("../lib/attendance/photo.ts");

test("path foto berada di dalam ATTENDANCE_UPLOAD_DIR", () => {
  assert.equal(
    attendancePhotoRelativePath("user_1", "2026-10-21", "foto_1"),
    "user_1/2026/10/foto_1.webp",
  );

  const path = resolveAttendancePhotoPath("user_1/2026/10/foto_1.webp");
  assert.ok(path);
  assert.equal(path.absolute, resolve(uploadDir, "user_1/2026/10/foto_1.webp"));
});

test("path traversal, path absolut, dan ekstensi lain ditolak", () => {
  assert.equal(resolveAttendancePhotoPath("../etc/passwd.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/../../foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/../foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("/etc/passwd.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1\\2026\\10\\foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/.rahasia.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/foto.jpg"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/foto.webp\0"), null);
  assert.equal(resolveAttendancePhotoPath(null), null);
});

test("simpan, baca, dan hapus foto berjalan di root yang dikonfigurasi", async () => {
  const bytes = Buffer.from("data-foto-uji");
  const relativePath = await saveAttendancePhoto({
    userId: "user_1",
    dateKey: "2026-10-21",
    bytes,
  });

  assert.match(relativePath, /^user_1\/2026\/10\/[a-f0-9-]+\.webp$/);
  const file = await resolveAttendancePhoto(relativePath);
  assert.ok(file);
  assert.equal(file.size, bytes.length);

  const read = await readAttendancePhoto(relativePath);
  assert.ok(read);
  assert.deepEqual(read.bytes, bytes);

  await deleteAttendancePhoto(relativePath);
  assert.equal(await readAttendancePhoto(relativePath), null);
});

test("id pegawai tidak aman tidak bisa dipakai membuat path", () => {
  assert.throws(
    () => attendancePhotoRelativePath("../user", "2026-10-21"),
    AttendancePhotoError,
  );
  assert.throws(
    () => attendancePhotoRelativePath("user_1", "2026-02-30"),
    AttendancePhotoError,
  );
  assert.throws(
    () => attendancePhotoRelativePath("user_1", "2026-10-21", "../foto"),
    AttendancePhotoError,
  );
});

test("foto bukan gambar ditolak sebelum disimpan", async () => {
  const file = new File([Buffer.from("bukan gambar")], "foto.jpg", { type: "image/jpeg" });
  await assert.rejects(() => optimizeAttendancePhoto(file), AttendancePhotoError);
});

test.after(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});
