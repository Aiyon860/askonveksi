import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { register } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

register(new URL("./helpers/cms-loader.mjs", import.meta.url));

const dataDir = await mkdtemp(join(tmpdir(), "askonveksi-cms-store-"));
process.env.CMS_DATA_DIR = dataDir;

const store = await import("../lib/cms/store.ts");
const seed = JSON.parse(await readFile(new URL("../lib/cms/seed-content.json", import.meta.url), "utf8"));

const actor = { id: "user-1", name: "Owner Pertama" };
const contentPath = join(dataDir, "content.json");
const versionsDir = join(dataDir, "versions");

function editedSeed(mutate) {
  const copy = structuredClone(seed);
  mutate(copy);
  return copy;
}

test("konten dibaca dari seed saat file belum ada", async () => {
  const content = await store.readSiteContent();
  assert.equal(content.version, seed.version);
  assert.equal(content.products.length, seed.products.length);
});

test("ensureCmsStorage membuat direktori dan menulis konten awal", async () => {
  await store.ensureCmsStorage();
  const raw = JSON.parse(await readFile(contentPath, "utf8"));
  assert.equal(raw.version, seed.version);
  const stats = await readdir(versionsDir);
  assert.deepEqual(stats, []);
});

test("simpan menaikkan versi, mengisi metadata, dan membuat snapshot", async () => {
  const current = await store.readSiteContent();
  const next = editedSeed((content) => {
    content.home.hero.titleLine1 = "Judul baru dari pengujian";
  });

  const saved = await store.saveSiteContent(next, current.version, actor);
  assert.equal(saved.version, current.version + 1);
  assert.equal(saved.updatedBy.name, actor.name);
  assert.equal(saved.home.hero.titleLine1, "Judul baru dari pengujian");

  const stored = await store.readSiteContent();
  assert.equal(stored.home.hero.titleLine1, "Judul baru dari pengujian");

  const versions = await store.listContentVersions();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].version, current.version);
  assert.equal(versions[0].updatedBy, "Konten awal");

  const snapshot = await store.readContentVersion(versions[0].file);
  assert.equal(snapshot.home.hero.titleLine1, seed.home.hero.titleLine1);
});

test("simpan dengan versi lama ditolak sebagai konflik", async () => {
  const next = editedSeed((content) => {
    content.home.hero.titleLine2 = "Tidak boleh tersimpan";
  });
  await assert.rejects(() => store.saveSiteContent(next, 0, actor), store.CmsConflictError);
  const stored = await store.readSiteContent();
  assert.equal(stored.home.hero.titleLine2, seed.home.hero.titleLine2);
});

test("konten tidak valid ditolak dan file tidak berubah", async () => {
  const before = await readFile(contentPath, "utf8");
  const current = await store.readSiteContent();
  const invalid = editedSeed((content) => {
    content.site.whatsapp = "bukan nomor";
  });
  await assert.rejects(() => store.saveSiteContent(invalid, current.version, actor), store.CmsValidationError);
  assert.equal(await readFile(contentPath, "utf8"), before);
});

test("HTML berbahaya disanitasi sebelum disimpan", async () => {
  const current = await store.readSiteContent();
  const next = editedSeed((content) => {
    content.home.hero.description = '<p>Halo <script>alert(1)</script><strong>aman</strong></p>';
  });
  const saved = await store.saveSiteContent(next, current.version, actor);
  assert.doesNotMatch(saved.home.hero.description, /script/i);
  assert.match(saved.home.hero.description, /<strong>aman<\/strong>/);
});

test("versi lama bisa dipulihkan sebagai versi baru tanpa menghapus riwayat", async () => {
  const before = await store.readSiteContent();
  const versions = await store.listContentVersions();
  const oldest = versions[versions.length - 1];

  const restored = await store.restoreSiteContent(oldest.file, actor);
  assert.equal(restored.version, before.version + 1);
  assert.equal(restored.home.hero.titleLine1, seed.home.hero.titleLine1);

  const after = await store.listContentVersions();
  assert.ok(after.length > versions.length);
});

test("nama file versi berbahaya ditolak", async () => {
  assert.equal(await store.readContentVersion("../../etc/passwd"), null);
  await assert.rejects(() => store.restoreSiteContent("../../etc/passwd", actor), store.CmsValidationError);
});

test("penyimpanan selesai secara atomik tanpa file sementara tersisa", async () => {
  const files = await readdir(dataDir);
  assert.equal(files.some((name) => name.endsWith(".tmp")), false);
  assert.equal(files.some((name) => name === ".lock"), false);
});

test.after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});
