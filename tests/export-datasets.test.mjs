import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

const registry = await readFile(new URL("lib/export/registry.ts", root), "utf8");

function registryIds() {
  return [...registry.matchAll(/^ {2}"?([a-z][a-z-]*)"?: \{\n {4}title:/gm)].map((match) => match[1]);
}

test("setiap dataset export punya judul, sheet, subjek file, kolom, dan loader", () => {
  const ids = registryIds();
  assert.ok(ids.length >= 20, `jumlah dataset (${ids.length}) minimal 20`);
  assert.equal(new Set(ids).size, ids.length, "id dataset unik");

  for (const id of ids) {
    const start = registry.indexOf(`  ${id}: {`) >= 0 ? registry.indexOf(`  ${id}: {`) : registry.indexOf(`  "${id}": {`);
    const end = registry.indexOf("\n  },", start);
    const block = registry.slice(start, end);
    assert.match(block, /title: "/, `${id} punya title`);
    assert.match(block, /sheetName: "/, `${id} punya sheetName`);
    assert.match(block, /subject: "[a-z0-9-]+"/, `${id} punya subject untuk nama file`);
    assert.match(block, /columns: [A-Z][A-Z0-9_]*/, `${id} memakai definisi kolom`);
    assert.match(block, /load: load[A-Z]/, `${id} punya loader`);
  }
});

test("setiap tombol ExportButton/ExportMenu memakai dataset yang terdaftar", async () => {
  const ids = new Set(registryIds());
  const entries = await readdir(new URL("app/(app)", root), { recursive: true });
  const pages = entries.filter((entry) => entry.endsWith(".tsx"));
  const used = new Set();

  for (const page of pages) {
    const source = await readFile(new URL(`app/(app)/${page}`, root), "utf8");
    for (const match of source.matchAll(/dataset="([a-z][a-z-]*)"/g)) used.add(match[1]);
    for (const match of source.matchAll(/dataset: "([a-z][a-z-]*)"/g)) used.add(match[1]);
  }

  assert.ok(used.size >= 12, `halaman memakai ${used.size} dataset`);
  for (const id of used) assert.ok(ids.has(id), `dataset "${id}" terdaftar di registry`);
});

test("server hanya mengirim data: tidak ada pembuatan file di registry/dataset", async () => {
  const files = [
    "lib/export/registry.ts",
    "lib/export/datasets/finance.ts",
    "lib/export/datasets/crm.ts",
    "lib/export/datasets/orders.ts",
    "lib/export/datasets/hr.ts",
    "lib/export/datasets/master.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /writeBuffer|xlsx\.write|createMasterDataWorkbook|createCustomerWorkbook/, `${file} tidak merender file`);
    assert.doesNotMatch(source, /Content-Disposition/, `${file} tidak mengirim attachment`);
  }
});

test("dataset non-paged tidak meminta halaman berikutnya (hindari duplikasi baris)", async () => {
  const route = await readFile(new URL("app/api/export/[dataset]/route.ts", root), "utf8");
  // Laporan/absensi/master mengirim semua baris sekaligus.
  for (const id of ["laporan", "absensi", "master-jenis-customer", "master-sumber-lead", "master-kategori-produk", "master-ukuran-pakaian", "master-metode-pembayaran"]) {
    const start = registry.indexOf(`  "${id}": {`) >= 0 ? registry.indexOf(`  "${id}": {`) : registry.indexOf(`  ${id}: {`);
    const block = registry.slice(start, registry.indexOf("\n  },", start));
    assert.match(block, /paged: false/, `${id} ditandai paged: false`);
  }
  assert.match(route, /definition\.paged === false \|\| result\.rows\.length < page\.limit/);
  // Dataset berpaging tidak boleh punya flag false.
  assert.equal((registry.match(/paged: false/g) ?? []).length, 7, "hanya 7 dataset non-paged");
});

test("worker Excel dilayani sebagai aset statis dengan vendor yang disinkronkan", async () => {
  const [pkg, worker, vendorScript] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/export-worker.js", root), "utf8"),
    readFile(new URL("scripts/sync-export-vendor.mjs", root), "utf8"),
  ]);
  // Turbopack 16.3 menerbitkan worker entry sebagai aset .ts mentah, jadi worker
  // dilayani dari /public dan ExcelJS dimuat lewat importScripts.
  assert.match(worker, /importScripts\("\/vendor\/exceljs\.min\.js"\)/);
  assert.match(worker, /self\.onmessage/);
  assert.match(worker, /type: "done"/);
  assert.match(vendorScript, /node_modules\/exceljs\/dist\/exceljs\.min\.js/);
  assert.match(pkg, /"export:vendor": "node scripts\/sync-export-vendor\.mjs"/);
  assert.match(pkg, /"prebuild": "npm run export:vendor"/);
  assert.match(pkg, /"predev": "npm run export:vendor"/);
});

test("setiap loader dataset memakai otorisasi per peran", async () => {
  const datasets = [
    "lib/export/datasets/finance.ts",
    "lib/export/datasets/crm.ts",
    "lib/export/datasets/orders.ts",
    "lib/export/datasets/hr.ts",
    "lib/export/datasets/master.ts",
  ];
  for (const file of datasets) {
    const source = await readFile(new URL(file, root), "utf8");
    const loaders = [...source.matchAll(/export async function (load[A-Za-z]+)\(/g)].map((match) => match[1]);
    assert.ok(loaders.length > 0, `${file} punya loader`);
    for (const loader of loaders) {
      const start = source.indexOf(`export async function ${loader}(`);
      const next = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      // Loader boleh memakai requireActor/requireDeveloperActor langsung, atau getter
      // ber-otorisasi dari domain (requireActor di dalam lib masing-masing).
      assert.match(
        body,
        /requireActor\(|requireDeveloperActor\(|getAttendanceReport\(|getCustomersForExport\(|getFinanceReport\(|getIncomeForExport\(|getExpensesForExport\(|getDeletedExpensesForExport\(|get(CustomerTypes|LeadSources|GarmentSizes|ProductCategories|PaymentMethods)\(/,
        `${loader} memeriksa peran sebelum membaca data`,
      );
    }
  }
});
