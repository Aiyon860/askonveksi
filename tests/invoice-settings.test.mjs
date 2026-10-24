import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { invoiceSettingsSchema } from "../lib/crm/validation.ts";
import { invoicePointPlainText, parseInvoicePointRuns } from "../lib/crm/invoice-setting-html.ts";
import { sanitizeInvoicePointHtml } from "../lib/crm/invoice-setting-sanitize.ts";
import { MIN_FONT_SIZE, PRINT_MIN_FONT_PX } from "../lib/crm/pdf-typography.ts";

const [
  schemaSource,
  migrationSource,
  richMigrationSource,
  actionSource,
  masterDataSource,
  pageSource,
  editorSource,
  richEditorSource,
  navSource,
  invoicePdfSource,
  invoiceRouteSource,
  purchaseOrderPdfSource,
  receiptPdfSource,
] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261015000000_invoice_setting_points/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261022030000_invoice_setting_point_rich_text/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/master-data/invoice-settings/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/invoice-settings-editor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/invoice-setting-rich-editor.tsx", import.meta.url), "utf8"),
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

test("poin pengaturan invoice menyimpan fragmen HTML, bukan flag bold", () => {
  assert.match(schemaSource, /enum InvoiceSettingSection \{\n  KETERANGAN\n  SYARAT_KETENTUAN\n\}/);
  const model = schemaSource.slice(schemaSource.indexOf("model InvoiceSettingPoint {"));
  assert.match(model, /section\s+InvoiceSettingSection/);
  assert.match(model, /text\s+String\s+@db\.Text/);
  assert.doesNotMatch(model, /isBold/, "isBold sudah dihapus dari model");
  assert.match(model, /position\s+Int\s+@default\(0\)/);
  assert.match(model, /@@index\(\[section, position\]\)/);
  assert.match(migrationSource, /CREATE TYPE "InvoiceSettingSection" AS ENUM \('KETERANGAN', 'SYARAT_KETENTUAN'\)/);
  assert.match(migrationSource, /CREATE TABLE "InvoiceSettingPoint"/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE "InvoiceSettingPoint" FROM anon, authenticated/);
  // Migrasi rich text: escape data lama, baris baru jadi <br>, bold lama jadi <strong>, lalu drop kolom.
  assert.match(richMigrationSource, /replace\(replace\(replace\("text", '&', '&amp;'\), '<', '&lt;'\), '>', '&gt;'\)/);
  assert.match(richMigrationSource, /E'\\n', '<br>'/);
  assert.match(richMigrationSource, /'<strong>' \|\| "text" \|\| '<\/strong>'/);
  assert.match(richMigrationSource, /ALTER TABLE "InvoiceSettingPoint" DROP COLUMN "isBold"/);
});

test("halaman pengaturan invoice memakai editor WYSIWYG dengan tepat tiga tombol format", () => {
  assert.match(masterDataSource, /export async function getInvoiceSettingPoints/);
  assert.match(masterDataSource, /requireActor\(MASTER_DATA_ROLES\)/);
  assert.doesNotMatch(masterDataSource, /isBold/);
  assert.match(pageSource, /InvoiceSettingsEditor/);
  assert.match(pageSource, /saveInvoiceSettingsAction/);
  assert.match(navSource, /href: "\/master-data\/invoice-settings", label: "Pengaturan invoice"/);
  // Satu editor kaya per kolom; paragraf = poin.
  assert.match(editorSource, /InvoiceSettingRichEditor/);
  assert.match(editorSource, /name="points"/);
  assert.match(editorSource, /invoicePointPlainText/);
  assert.doesNotMatch(editorSource, /<Textarea/);
  assert.doesNotMatch(editorSource, /Tambah poin/);
  // Toolbar hanya Tebal, Miring, Garis bawah — tanpa daftar/link/heading/undo di toolbar.
  assert.match(richEditorSource, /"Tebal"/);
  assert.match(richEditorSource, /"Miring"/);
  assert.match(richEditorSource, /"Garis bawah"/);
  for (const icon of ["Link2", "List", "ListOrdered", "RemoveFormatting", "Undo2", "Redo2", "Heading", "Strike"]) {
    assert.doesNotMatch(richEditorSource, new RegExp(`\\b${icon}\\b`), `toolbar tidak memakai ${icon}`);
  }
  // Fitur format lain dimatikan pada StarterKit.
  assert.match(richEditorSource, /heading: false/);
  assert.match(richEditorSource, /link: false/);
  assert.match(richEditorSource, /orderedList: false/);
  assert.match(richEditorSource, /strike: false/);
  assert.match(richEditorSource, /Placeholder\.configure/);
});

test("action menyimpan dua kolom sekaligus dan menghapus poin yang dibuang user", () => {
  const action = actionSource.slice(actionSource.indexOf("export async function saveInvoiceSettingsAction"));
  assert.match(action, /requireActor\(MASTER_DATA_ADMIN_ROLES\)/);
  assert.match(action, /invoiceSettingsSchema\.safeParse/);
  assert.match(action, /TransactionIsolationLevel\.Serializable/);
  assert.match(action, /section: "KETERANGAN"/);
  assert.match(action, /section: "SYARAT_KETENTUAN"/);
  assert.match(action, /INVOICE_SETTING_POINT_CREATED/);
  assert.match(action, /INVOICE_SETTING_POINT_UPDATED/);
  assert.match(action, /INVOICE_SETTING_POINT_DELETED/);
  assert.match(action, /revalidatePath\("\/master-data\/invoice-settings"\)/);
  assert.doesNotMatch(action, /isBold/, "action tidak lagi menyimpan flag bold");
  assert.ok(action.includes("keptIds.has(row.id)"), "poin yang hilang dari form dihapus");
});

test("sanitizer poin hanya mengizinkan strong/em/u/br dan membuang tag lain", () => {
  assert.equal(sanitizeInvoicePointHtml("<strong>Tebal</strong> <em>miring</em> <u>garis</u>"), "<strong>Tebal</strong> <em>miring</em> <u>garis</u>");
  assert.equal(sanitizeInvoicePointHtml("<b>Satu</b> <i>dua</i>"), "<strong>Satu</strong> <em>dua</em>");
  assert.equal(sanitizeInvoicePointHtml('<a href="https://x.test">Teks</a>'), "Teks");
  assert.equal(sanitizeInvoicePointHtml("<script>alert(1)</script>Aman"), "Aman");
  assert.equal(sanitizeInvoicePointHtml('<img src="x" onerror="y">Halo'), "Halo");
  assert.match(sanitizeInvoicePointHtml("<p>Satu</p><p>Dua</p>"), /^(?!.*<p>)/, "paragraf luar tidak disimpan");
  assert.equal(sanitizeInvoicePointHtml("baris satu<br>baris dua"), "baris satu<br>baris dua");
});

test("parser run membaca campuran tebal/miring/garis bawah untuk PDF", () => {
  const mixed = parseInvoicePointRuns("Halo <strong>dunia</strong> dan <em>kamu</em>");
  assert.deepEqual(
    mixed.map((run) => [run.text, run.bold, run.italic, run.underline]),
    [
      ["Halo ", false, false, false],
      ["dunia", true, false, false],
      [" dan ", false, false, false],
      ["kamu", false, true, false],
    ],
  );
  const nested = parseInvoicePointRuns("<strong><em><u>Semua</u></em></strong>");
  assert.deepEqual(nested, [{ text: "Semua", bold: true, italic: true, underline: true }]);
  assert.equal(parseInvoicePointRuns("A<br>B")[0].text, "A\nB");
  assert.equal(parseInvoicePointRuns("Harga &lt; 1jt &amp; aman")[0].text, "Harga < 1jt & aman");
  assert.equal(invoicePointPlainText("<strong>Halo</strong> <em>dunia</em><br>baris"), "Halo dunia baris");
});

test("validasi poin memakai teks terlihat, membatasi jumlah, dan menyimpan HTML", () => {
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [], syarat: [] }).success, true);
  const valid = invoiceSettingsSchema.safeParse({
    keterangan: [{ id: undefined, text: "<strong>Harga sudah termasuk bordir</strong>" }],
    syarat: [{ id: undefined, text: "Pelunasan <em>maksimal</em> 7 hari" }],
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.keterangan[0].text, "<strong>Harga sudah termasuk bordir</strong>");
  assert.equal(valid.data?.syarat[0].text, "Pelunasan <em>maksimal</em> 7 hari");
  // Field bold lama diabaikan (zod strip).
  const stripped = invoiceSettingsSchema.safeParse({ keterangan: [{ text: "<u>Dua</u>", bold: true }], syarat: [] });
  assert.equal(stripped.success, true);
  assert.equal("bold" in (stripped.data?.keterangan[0] ?? {}), false);
  // Tag berbahaya dibuang sebelum disimpan.
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [{ text: '<a href="x">Aman</a>' }], syarat: [] }).data?.keterangan[0].text, "Aman");
  // Panjang dihitung dari teks terlihat.
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [{ text: "<strong>x</strong>" }], syarat: [] }).success, false);
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [{ text: `A`.repeat(1001) }], syarat: [] }).success, false);
  assert.equal(invoiceSettingsSchema.safeParse({ keterangan: [{ text: `A${"<strong></strong>".repeat(1000)}` }], syarat: [] }).success, false);
  const tooMany = invoiceSettingsSchema.safeParse({
    keterangan: Array.from({ length: 21 }, (_, index) => ({ text: `<strong>Poin ${index}</strong>` })),
    syarat: [],
  });
  assert.equal(tooMany.success, false);
});

test("PDF invoice mencetak poin bergaya tebal/miring/garis bawah sebagai ganti blok catatan", () => {
  assert.match(invoicePdfSource, /settingPoints\?: PdfInvoiceSettingPoint\[\]/);
  assert.match(invoicePdfSource, /type PdfInvoiceSettingPoint = \{ section: "KETERANGAN" \| "SYARAT_KETENTUAN"; text: string \}/);
  assert.match(invoicePdfSource, /drawPointList\("Keterangan"/);
  assert.match(invoicePdfSource, /drawPointList\("Syarat & Ketentuan"/);
  assert.match(invoicePdfSource, /parseInvoicePointRuns/);
  assert.match(invoicePdfSource, /HelveticaOblique/);
  assert.match(invoicePdfSource, /HelveticaBoldOblique/);
  assert.match(invoicePdfSource, /layoutPointLines/);
  // Garis bawah digambar manual karena font standar PDF tidak punya dekorasi.
  assert.match(invoicePdfSource, /if \(token\.underline\) \{[\s\S]*page\.drawLine\(\{ start: \{ x: cursorX/);
  assert.doesNotMatch(invoicePdfSource, /point\.isBold/);
  assert.doesNotMatch(invoicePdfSource, /invoice\.notes/, "blok Catatan lama tidak dicetak lagi");
  assert.match(invoiceRouteSource, /invoiceSettingPoint\.findMany\(\{ orderBy: \[\{ section: "asc" \}, \{ position: "asc" \}\]/);
  assert.match(invoiceRouteSource, /select: \{ section: true, text: true \}/);
  assert.doesNotMatch(invoiceRouteSource, /isBold/);
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
