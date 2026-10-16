import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { invoiceSettingsSchema } from "../lib/crm/validation.ts";
import { MIN_FONT_SIZE, PRINT_MIN_FONT_PX } from "../lib/crm/pdf-typography.ts";

const [
  schemaSource,
  migrationSource,
  actionSource,
  masterDataSource,
  pageSource,
  editorSource,
  navSource,
  invoicePdfSource,
  invoiceRouteSource,
  purchaseOrderPdfSource,
  receiptPdfSource,
] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261015000000_invoice_setting_points/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/master-data/invoice-settings/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/invoice-settings-editor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/invoice/[id]/pdf/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/receipt-pdf.ts", import.meta.url), "utf8"),
]);

const PDF_SOURCES = {
  "purchase-order-pdf.ts": purchaseOrderPdfSource,
  "invoice-pdf.ts": invoicePdfSource,
  "receipt-pdf.ts": receiptPdfSource,
};

test("master pengaturan invoice punya dua kolom poin dengan urutan manual dan penanda bold", () => {
  assert.match(schemaSource, /enum InvoiceSettingSection \{\n  KETERANGAN\n  SYARAT_KETENTUAN\n\}/);
  const model = schemaSource.slice(schemaSource.indexOf("model InvoiceSettingPoint {"));
  assert.match(model, /section\s+InvoiceSettingSection/);
  assert.match(model, /text\s+String\s+@db\.VarChar\(300\)/);
  assert.match(model, /isBold\s+Boolean\s+@default\(false\)/);
  assert.match(model, /position\s+Int\s+@default\(0\)/);
  assert.match(model, /@@index\(\[section, position\]\)/);
  assert.match(migrationSource, /CREATE TYPE "InvoiceSettingSection" AS ENUM \('KETERANGAN', 'SYARAT_KETENTUAN'\)/);
  assert.match(migrationSource, /CREATE TABLE "InvoiceSettingPoint"/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE "InvoiceSettingPoint" FROM anon, authenticated/);
});

test("halaman pengaturan invoice memuat editor poin dengan tombol tambah, panah, dan bold", () => {
  assert.match(masterDataSource, /export async function getInvoiceSettingPoints/);
  assert.match(masterDataSource, /requireActor\(MASTER_DATA_ROLES\)/);
  assert.match(pageSource, /InvoiceSettingsEditor/);
  assert.match(pageSource, /saveInvoiceSettingsAction/);
  assert.match(navSource, /href: "\/master-data\/invoice-settings", label: "Pengaturan invoice"/);
  for (const icon of ["ArrowUp", "ArrowDown", "Bold", "Plus", "Trash2"]) {
    assert.match(editorSource, new RegExp(`\\b${icon}\\b`), `editor memakai ikon ${icon}`);
  }
  assert.match(editorSource, /Tambah poin/);
  assert.match(editorSource, /aria-pressed=\{point\.bold\}/);
});

test("action menyimpan dua kolom sekaligus dan menghapus poin yang dibuang user", () => {
  const action = actionSource.slice(actionSource.indexOf("export async function saveInvoiceSettingsAction"));
  assert.match(action, /requireActor\(MASTER_DATA_ROLES\)/);
  assert.match(action, /invoiceSettingsSchema\.safeParse/);
  assert.match(action, /TransactionIsolationLevel\.Serializable/);
  assert.match(action, /section: "KETERANGAN"/);
  assert.match(action, /section: "SYARAT_KETENTUAN"/);
  assert.match(action, /INVOICE_SETTING_POINT_CREATED/);
  assert.match(action, /INVOICE_SETTING_POINT_UPDATED/);
  assert.match(action, /INVOICE_SETTING_POINT_DELETED/);
  assert.match(action, /revalidatePath\("\/master-data\/invoice-settings"\)/);
  assert.ok(action.includes("keptIds.has(row.id)"), "poin yang hilang dari form dihapus");
});

test("validasi poin menolak teks kosong dan membatasi jumlah poin per kolom", () => {
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [], syarat: [] }).success, true);
  const valid = invoiceSettingsSchema.safeParse({
    keterangan: [{ id: undefined, text: "Harga sudah termasuk bordir", bold: true }],
    syarat: [{ id: undefined, text: "Pelunasan maksimal 7 hari", bold: false }],
  });
  assert.equal(valid.success, true);
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [{ text: "x", bold: false }], syarat: [] }).success, false);
  const tooMany = invoiceSettingsSchema.safeParse({
    keterangan: Array.from({ length: 21 }, (_, index) => ({ text: `Poin ${index}`, bold: false })),
    syarat: [],
  });
  assert.equal(tooMany.success, false);
});

test("PDF invoice mencetak poin keterangan & syarat/ketentuan sebagai ganti blok catatan", () => {
  assert.match(invoicePdfSource, /settingPoints\?: PdfInvoiceSettingPoint\[\]/);
  assert.match(invoicePdfSource, /drawPointList\("Keterangan"/);
  assert.match(invoicePdfSource, /drawPointList\("Syarat & Ketentuan"/);
  assert.match(invoicePdfSource, /point\.isBold \? bold : regular/);
  assert.doesNotMatch(invoicePdfSource, /invoice\.notes/, "blok Catatan lama tidak dicetak lagi");
  assert.match(invoiceRouteSource, /invoiceSettingPoint\.findMany\(\{ orderBy: \[\{ section: "asc" \}, \{ position: "asc" \}\]/);
});

test("tiga dokumen cetak memakai ukuran font minimum 16 px (12 pt)", () => {
  assert.equal(PRINT_MIN_FONT_PX, 16);
  assert.equal(MIN_FONT_SIZE, 12);
  for (const [name, source] of Object.entries(PDF_SOURCES)) {
    assert.match(source, /MIN_FONT_SIZE/, `${name} memakai konstanta font minimum bersama`);
    for (const [, size] of source.matchAll(/size:\s*(\d+(?:\.\d+)?)/g)) {
      assert.ok(Number(size) >= MIN_FONT_SIZE, `${name} memakai ukuran font ${size} pt (minimum ${MIN_FONT_SIZE} pt)`);
    }
  }
});
