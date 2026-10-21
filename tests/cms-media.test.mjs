import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const uploadDir = await mkdtemp(join(tmpdir(), "askonveksi-cms-media-"));
process.env.CMS_UPLOAD_DIR = uploadDir;

const { mediaContentType, resolveMediaFile } = await import("../lib/cms/media.ts");

await mkdir(join(uploadDir, "2026/10"), { recursive: true });
await writeFile(join(uploadDir, "2026/10/gambar.webp"), Buffer.from("test"));
await writeFile(join(uploadDir, "2026/10/catatan.txt"), "bukan gambar");
await writeFile(join(uploadDir, "2026/10/.rahasia.webp"), Buffer.from("test"));

test("gambar valid di dalam root berhasil dibaca", async () => {
  const file = await resolveMediaFile(["2026", "10", "gambar.webp"]);
  assert.ok(file);
  assert.equal(file.extension, ".webp");
  assert.equal(file.absolute, join(uploadDir, "2026/10/gambar.webp"));
});

test("path traversal ditolak", async () => {
  assert.equal(await resolveMediaFile(["..", "..", "etc", "passwd.webp"]), null);
  assert.equal(await resolveMediaFile(["2026", "..", "gambar.webp"]), null);
  assert.equal(await resolveMediaFile(["2026/../../gambar.webp"]), null);
});

test("dotfile dan ekstensi bukan gambar ditolak", async () => {
  assert.equal(await resolveMediaFile(["2026", "10", ".rahasia.webp"]), null);
  assert.equal(await resolveMediaFile(["2026", "10", "catatan.txt"]), null);
});

test("file yang tidak ada ditolak", async () => {
  assert.equal(await resolveMediaFile(["2026", "10", "hilang.webp"]), null);
  assert.equal(await resolveMediaFile([]), null);
});

test("content type sesuai ekstensi", () => {
  assert.equal(mediaContentType(".webp"), "image/webp");
  assert.equal(mediaContentType(".png"), "image/png");
  assert.equal(mediaContentType(".jpg"), "image/jpeg");
  assert.equal(mediaContentType(".jpeg"), "image/jpeg");
  assert.equal(mediaContentType(".avif"), "image/avif");
});

test.after(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});
