import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const storageRoot = await mkdtemp(join(tmpdir(), "askonveksi-erp-storage-"));
process.env.ERP_STORAGE_DIR = storageRoot;
process.env.ERP_STORAGE_DRIVER = "local";

const {
  StorageError,
  assertStorageReady,
  contentTypeFromPath,
  fileExists,
  getFile,
  putFile,
  removeFiles,
  resolveSafe,
  statFile,
  storageDriver,
  storeRoot,
} = await import("../lib/storage/local-store.mjs");
const { erpStorage } = await import("../lib/storage/erp-storage.ts");

const BUCKET = "crm-po-designs";

test("root storage mengikuti ERP_STORAGE_DIR", () => {
  assert.equal(storeRoot(), storageRoot);
  assert.equal(storageDriver(), "local");
  assert.equal(assertStorageReady(), "local");
});

test("validasi path menolak traversal, absolut, backslash, NUL, dan bucket tidak valid", () => {
  assert.equal(resolveSafe(BUCKET, "../etc/passwd"), null);
  assert.equal(resolveSafe(BUCKET, "design/../../etc/passwd"), null);
  assert.equal(resolveSafe(BUCKET, "/etc/passwd"), null);
  assert.equal(resolveSafe(BUCKET, "design\\a.png"), null);
  assert.equal(resolveSafe(BUCKET, "design/a\0.png"), null);
  assert.equal(resolveSafe(BUCKET, ".hidden/a.png"), null);
  assert.equal(resolveSafe(BUCKET, "design//a.png"), null);
  assert.equal(resolveSafe("../evil", "a.png"), null);
  assert.equal(resolveSafe("Business Assets", "a.png"), null);

  const safe = resolveSafe(BUCKET, "design/task-1/a.png");
  assert.ok(safe);
  assert.equal(safe.absolute, join(storageRoot, BUCKET, "design/task-1/a.png"));
});

test("put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi", async () => {
  const samples = [
    ["design/task-1/a.png", "image/png"],
    ["design/task-1/b.jpg", "image/jpeg"],
    ["design/task-1/c.jpeg", "image/jpeg"],
    ["design/task-1/d.webp", "image/webp"],
    ["proofs/e.pdf", "application/pdf"],
    ["whatsapp/account/2026-10-23/message-id", "application/octet-stream"],
  ];

  for (const [path, expected] of samples) {
    const bytes = Buffer.from(`isi-${path}`);
    await putFile(BUCKET, path, bytes, { upsert: false });
    const read = await getFile(BUCKET, path);
    assert.ok(read);
    assert.deepEqual(read, bytes);
    assert.equal(contentTypeFromPath(path), expected);
    assert.equal(await fileExists(BUCKET, path), true);
    assert.equal((await statFile(BUCKET, path))?.size, bytes.length);
  }
});

test("upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp", async () => {
  const path = "design/task-2/overwrite.png";
  await putFile(BUCKET, path, Buffer.from("versi-1"), { upsert: false });
  await assert.rejects(
    () => putFile(BUCKET, path, Buffer.from("versi-2"), { upsert: false }),
    (error) => error instanceof StorageError && error.status === 409,
  );
  assert.equal((await getFile(BUCKET, path)).toString(), "versi-1");

  await putFile(BUCKET, path, Buffer.from("versi-3"), { upsert: true });
  assert.equal((await getFile(BUCKET, path)).toString(), "versi-3");

  const folder = join(storageRoot, BUCKET, "design/task-2");
  const entries = await readdir(folder);
  assert.equal(entries.some((entry) => entry.startsWith(".tmp-")), false, "tidak ada file temp tertinggal");
});

test("get/stat untuk path hilang atau tidak valid mengembalikan null", async () => {
  assert.equal(await getFile(BUCKET, "design/task-3/tidak-ada.png"), null);
  assert.equal(await statFile(BUCKET, "design/task-3/tidak-ada.png"), null);
  assert.equal(await getFile(BUCKET, "../rahasia.png"), null);
  assert.equal(await statFile(BUCKET, "../rahasia.png"), null);
  assert.equal(await fileExists(BUCKET, "../rahasia.png"), false);
});

test("removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid", async () => {
  const path = "design/task-4/hapus.png";
  await putFile(BUCKET, path, Buffer.from("hapus"), { upsert: false });

  const result = await removeFiles(BUCKET, [path, path, "../tidak-boleh"]);
  assert.equal(await fileExists(BUCKET, path), false);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].path, "../tidak-boleh");
});

test("driver invalid dan path relatif di produksi ditolak", () => {
  const previous = {
    driver: process.env.ERP_STORAGE_DRIVER,
    dir: process.env.ERP_STORAGE_DIR,
    nodeEnv: process.env.NODE_ENV,
  };
  try {
    process.env.ERP_STORAGE_DRIVER = "disk";
    assert.throws(() => storageDriver(), /ERP_STORAGE_DRIVER tidak valid/);

    process.env.ERP_STORAGE_DRIVER = "local";
    process.env.ERP_STORAGE_DIR = "data/erp-storage";
    process.env.NODE_ENV = "production";
    assert.throws(() => assertStorageReady(), /path absolut/);

    process.env.ERP_STORAGE_DIR = "";
    assert.throws(() => assertStorageReady(), /wajib diset/);
  } finally {
    process.env.ERP_STORAGE_DRIVER = previous.driver;
    process.env.ERP_STORAGE_DIR = previous.dir;
    process.env.NODE_ENV = previous.nodeEnv;
  }
});

test("adapter local: upload, download, exists, remove", async () => {
  const storage = erpStorage(BUCKET);
  const path = "design/task-5/adapter.png";
  const bytes = new Uint8Array(Buffer.from("adapter-bytes"));

  const uploaded = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
  assert.equal(uploaded.error, null);
  assert.equal(uploaded.data?.path, path);

  const exists = await storage.exists(path);
  assert.equal(exists.data, true);
  assert.equal(exists.error, null);

  const downloaded = await storage.download(path);
  assert.equal(downloaded.error, null);
  assert.ok(downloaded.data);
  assert.equal(downloaded.data.type, "image/png");
  assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()), Buffer.from(bytes));

  const removed = await storage.remove([path]);
  assert.equal(removed.error, null);
  assert.equal((await storage.exists(path)).data, false);
  assert.equal((await storage.download(path)).error?.status, 404);
});

test("adapter local: konflik upload, path invalid, dan file hilang", async () => {
  const storage = erpStorage(BUCKET);
  const path = "design/task-6/konflik.png";

  assert.equal((await storage.upload(path, new Uint8Array([1]), { upsert: false })).error, null);
  const conflict = await storage.upload(path, new Uint8Array([2]), { upsert: false });
  assert.equal(conflict.error?.status, 409);

  const invalid = await storage.upload("../keluar.png", new Uint8Array([3]), { upsert: false });
  assert.equal(invalid.error?.status, 400);

  const invalidDownload = await storage.download("../keluar.png");
  assert.equal(invalidDownload.error?.status, 400);
  assert.equal(invalidDownload.data, null);

  const invalidExists = await storage.exists("../keluar.png");
  assert.equal(invalidExists.data, null);
  assert.equal(invalidExists.error?.status, 400);
});

test("adapter local: upsert true menimpa gambar di path yang sama", async () => {
  const storage = erpStorage(BUCKET);
  const path = "design/task-6/edit-gambar.png";
  assert.equal((await storage.upload(path, new Uint8Array([1, 2, 3]), { contentType: "image/png", upsert: false })).error, null);
  assert.equal((await storage.upload(path, new Uint8Array([9, 8, 7, 6]), { contentType: "image/png", upsert: true })).error, null);
  const downloaded = await storage.download(path);
  assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()), Buffer.from([9, 8, 7, 6]));
  assert.equal((await storage.exists("design/task-6/tidak-ada.png")).data, false);
});

test.after(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});
