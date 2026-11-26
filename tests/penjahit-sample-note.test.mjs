import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, dialog, actions, data, page, pdfRoute, pdf] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261126010000_purchase_order_item_sample/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/crm/penjahit-plan-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/purchase-order/[id]/pdf/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8"),
]);

test("sampel per produk tersimpan di DB dengan qty default 1", () => {
  assert.match(schema, /sampleQty\s+Int\s+@default\(1\)/);
  assert.match(schema, /sampleSize\s+String\?\s+@db\.VarChar\(40\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "sampleQty" INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "sampleSize" VARCHAR\(40\)/);
});

test("dialog Edit PDF Penjahit menyediakan QTY (number, default 1) dan Ukuran sample (text)", () => {
  assert.match(dialog, /name={`sampleQty-\$\{item\.id\}`}/);
  assert.match(dialog, /name={`sampleSize-\$\{item\.id\}`}/);
  assert.match(dialog, /type="number"/);
  assert.match(dialog, /String\(item\.sampleQty \?\? 1\)/);
  assert.match(dialog, /value=\{sampleSizes\[item\.id\] \?\? ""\}/);
});

test("action menyimpan sampel dan menolak qty bukan bulat minimal 1", () => {
  assert.match(actions, /formData\.get\(`sampleQty-\$\{item\.id\}`\)/);
  assert.match(actions, /formData\.get\(`sampleSize-\$\{item\.id\}`\)/);
  assert.match(actions, /qty < 1/);
  assert.match(actions, /sampleQty: sampleQtys\.get\(item\.id\)!/);
  assert.match(actions, /sampleSize: sampleSizes\.get\(item\.id\) \?\? null/);
  // Sampel ikut tersalin saat PO direvisi.
  assert.match(actions, /sampleQty: source\.items\[position\]\?\.sampleQty \?\? 1/);
  assert.match(actions, /sampleQty: previousItems\[position\]\?\.sampleQty \?\? 1/);
});

test("sampel sampai ke PDF dari query sampai props dialog", () => {
  assert.match(data, /sampleQty: true, sampleSize: true/);
  assert.match(page, /sampleQty: item\.sampleQty/);
  assert.match(page, /sampleSize: item\.sampleSize \?\? null/);
  assert.match(pdfRoute, /sampleQty: true, sampleSize: true/);
  assert.match(pdf, /sampleQty: number; sampleSize: string \| null/);
});

test("NOTE sampel hanya dicetak di PDF penjahit", () => {
  // Gerbang variant berada sebelum komposisi sampel, jadi varian customer kembali lebih awal.
  assert.ok(pdf.indexOf('if (variant !== "penjahit") return designNote;') < pdf.indexOf("SAMPLE SIZE ${sampleSize} JML"));
  assert.match(pdf, /const sampleNote = `SAMPLE SIZE \$\{sampleSize\} JML \$\{item\?\.sampleQty \?\? 1\}`/);
  assert.match(pdf, /return designNote \? `\$\{sampleNote\} \| \$\{designNote\}` : sampleNote/);
  // NOTE dipakai dua jalur (size chart & aksesori) lewat helper yang sama.
  assert.match(pdf, /drawModelTable\(rows, noteFor\(item\)\)/);
  assert.match(pdf, /drawAccessoryTotal\(quantity, `JUMLAH PRODUK/);
});

test("teks NOTE dicetak bold hitam (bukan abu-abu)", () => {
  assert.equal((pdf.match(/font: bold, color: rgb\(0\.12, 0\.12, 0\.12\)/g) ?? []).length >= 2, true);
  assert.doesNotMatch(pdf, /noteText, \{[^}]*font: regular, color: rgb\(0\.28, 0\.28, 0\.28\)/);
});
