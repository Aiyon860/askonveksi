import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, dialog, actions, data, page, pdfRoute, pdf] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261126010000_purchase_order_item_sample/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/crm/penjahit-plan-section.tsx", import.meta.url), "utf8"),
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

test("section penjahit menyediakan QTY (number, default 1) dan Ukuran sample (text) berisi nilai lama", () => {
  assert.match(dialog, /name={`sampleQty-\$\{item\.id\}`}/);
  assert.match(dialog, /name={`sampleSize-\$\{item\.id\}`}/);
  assert.match(dialog, /type="number"/);
  // Nilai lama dipakai sebagai default, bukan state kosong saat dialog dibuka.
  assert.match(dialog, /defaultValue=\{String\(item\.sampleQty \?\? 1\)\}/);
  assert.match(dialog, /defaultValue=\{item\.sampleSize \?\? ""\}/);
  assert.match(dialog, /defaultValue=\{item\.deadline \?\? ""\}/);
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
  assert.match(pdf, /drawModelTable\(rows, noteFor\(item\), sampleFor\(item\)\)/);
  assert.match(pdf, /drawAccessoryTotal\(quantity, `JUMLAH PRODUK/);
});

test("ukuran sample wajib diisi di dialog dan di action", () => {
  assert.match(dialog, /htmlFor={`penjahit-sample-size-\$\{item\.id\}`} required/);
  assert.match(dialog, /name={`sampleSize-\$\{item\.id\}`}/);
  const input = dialog.slice(dialog.indexOf('name={`sampleSize-${item.id}`}'), dialog.indexOf('placeholder="Mis. M"'));
  assert.match(input, /required/);
  assert.match(actions, /if \(!size\) throw new UserFacingError\(`Ukuran sample \$\{item\.name\} wajib diisi\.`\)/);
});

test("TOTAL baris NOTE dan total lengan = order + sampel hanya di PDF penjahit", () => {
  assert.match(pdf, /function sampleQtyFor\(item: PurchaseOrderPdfItem \| undefined\)/);
  assert.match(pdf, /if \(variant !== "penjahit" \|\| !item\?\.sampleSize\?\.trim\(\)\) return 0;/);
  // Sampel ikut dihitung di tabel: grand total NOTE dan sel/total ukuran sampel memuatnya.
  assert.match(pdf, /const grandTotal = rows\.reduce\(\(sum, row\) => sum \+ row\.quantity, 0\) \+ sampleQty/);
  assert.match(pdf, /function sampleFor\(item: PurchaseOrderPdfItem \| undefined\)/);
  assert.match(pdf, /const quantity = quantityFor\(size, sleeve\) \+ sampleExtra/);
  assert.match(pdf, /centeredText\(String\(total \+ columnSampleQty\)/);
  assert.match(pdf, /String\(quantity \+ sampleQty\)/);
  assert.match(pdf, /drawModelTable\(rows, noteFor\(data\.items\[0\]\), sampleFor\(data\.items\[0\]\)\)/);
  assert.match(pdf, /drawAccessoryTotal\(totalQuantity, null, noteFor\(data\.items\[0\]\), sampleQtyFor\(data\.items\[0\]\)\)/);
  // Sampel hanya masuk hitungan penjahit, bukan dokumen customer.
  assert.match(pdf, /if \(variant !== "penjahit" \|\| !size\) return null;/);
  // Angka grad total memakai ukuran font minimum yang sama dengan teks lain.
  assert.match(pdf, /widthOfTextAtSize\(String\(grandTotal\), MIN_FONT_SIZE\)/);
  assert.match(pdf, /String\(grandTotal\), \{[^\n]*size: MIN_FONT_SIZE/);
});

test("teks NOTE dicetak bold hitam (bukan abu-abu)", () => {
  assert.equal((pdf.match(/font: bold, color: rgb\(0\.12, 0\.12, 0\.12\)/g) ?? []).length >= 2, true);
  assert.doesNotMatch(pdf, /noteText, \{[^}]*font: regular, color: rgb\(0\.28, 0\.28, 0\.28\)/);
});
