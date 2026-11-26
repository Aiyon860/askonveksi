import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, validation, form, actions, data, page, pdfRoute, pdf] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261126020000_purchase_order_item_material/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/crm/purchase-order-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/purchase-order/[id]/pdf/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8"),
]);

test("bahan tersimpan per produk dan data lama ter-backfill dari header", () => {
  assert.match(schema, /material\s+String\?\s+@db\.VarChar\(120\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "material" VARCHAR\(120\)/);
  assert.match(migration, /UPDATE "PurchaseOrderItem"/);
  assert.match(migration, /SET "material" = po\."material"/);
});

test("bahan wajib di schema item, bukan lagi input header", () => {
  assert.match(validation, /material: z\.string\(\)\.trim\(\)\.min\(2, "Bahan wajib diisi\."\)\.max\(120\)/);
  assert.match(form, /name={`\$\{prefix\}material`}/);
  assert.doesNotMatch(form, /name="material" required/);
  // Header tetap mengirim bahan produk pertama untuk konsumsi data lama.
  assert.match(form, /<input type="hidden" name="material" value=\{items\[0\]\?\.material \?\? ""\} \/>/);
  // Draft lama yang belum punya bahan per produk dibuang.
  assert.match(form, /const AUTOSAVE_VERSION = 8;/);
});

test("aksi menyimpan bahan tiap produk", () => {
  assert.match(actions, /material: formValue\(formData, `\$\{prefix\}material`\)/);
  assert.equal((actions.match(/material: item\.material,/g) ?? []).length, 3);
});

test("bahan sampai ke form revisi dan PDF tiap produk", () => {
  assert.match(data, /pola: true, material: true/);
  assert.match(page, /material: poItem\.material \?\? ""/);
  assert.match(pdfRoute, /pola: true, material: true/);
  assert.match(pdf, /material: string \| null/);
  assert.match(pdf, /\{ label: "Bahan", value: sheetItem\?\.material\?\.trim\(\) \|\| data\.material \}/);
});
