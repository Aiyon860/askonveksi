import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  pageSource,
  actionSource,
  validationSource,
  crmActionSource,
  schemaSource,
  migrationSource,
  invoiceRouteSource,
  invoicePdfSource,
  receiptRouteSource,
  receiptPdfSource,
  signatureRouteSource,
] = await Promise.all([
  readFile(new URL("../app/(app)/master-data/business-profile/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20261014030000_business_profile_signature/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/invoice/[id]/pdf/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/payment-transactions/[id]/kwitansi/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/receipt-pdf.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/master-data/business-profile/signature/route.ts", import.meta.url), "utf8"),
]);

function block(source, header, headerLength = header.length) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `blok ${header} harus ada`);
  const end = source.indexOf("\n}", start);
  assert.notEqual(end, -1, `blok ${header} harus tertutup`);
  return source.slice(start, end + headerLength);
}

test("profil perusahaan tidak lagi memuat field rekening bank", () => {
  for (const field of ["bankName", "bankAccountNumber", "bankAccountHolder"]) {
    assert.doesNotMatch(pageSource, new RegExp(`name="${field}"`), `form tidak boleh punya input ${field}`);
    assert.ok(!block(validationSource, "export const businessProfileSchema").includes(field), `businessProfileSchema tidak boleh memuat ${field}`);
    assert.ok(!block(actionSource, "export async function updateBusinessProfileAction").includes(`${field}: formData.get(`), `action tidak boleh membaca ${field}`);
  }
  assert.ok(!block(schemaSource, "model BusinessProfile").includes("bankName"), "kolom rekening dihapus dari skema");
});

test("skema dan migrasi memuat gambar tanda tangan", () => {
  const profile = block(schemaSource, "model BusinessProfile");
  assert.match(profile, /signaturePath\s+String\?\s+@db\.VarChar\(500\)/);
  assert.match(block(schemaSource, "model Invoice"), /snapshotSignaturePath\s+String\?/);
  assert.match(migrationSource, /ADD COLUMN "signaturePath" VARCHAR\(500\)/);
  assert.match(migrationSource, /ADD COLUMN "snapshotSignaturePath" VARCHAR\(500\)/);
  assert.match(migrationSource, /DROP COLUMN "bankAccountHolder"/);
});

test("unggah gambar tanda tangan divalidasi dan disimpan ke bucket privat", () => {
  const action = block(actionSource, "export async function updateBusinessProfileAction");
  assert.match(action, /readBusinessImage\(signature, "Gambar tanda tangan"\)/);
  assert.match(action, /business\/signature-\$\{randomUUID\(\)\}/);
  assert.match(action, /removeSignature/);
  const helper = block(actionSource, "async function readBusinessImage");
  assert.match(helper, /2 \* 1024 \* 1024/, "batas 2 MB ikut diterapkan ke gambar tanda tangan");
  assert.match(helper, /0x89, 0x50, 0x4e, 0x47/, "magic bytes PNG diperiksa");
  assert.match(pageSource, /name="signature" type="file"/);
  assert.match(pageSource, /api\/master-data\/business-profile\/signature/);
  assert.match(signatureRouteSource, /business-assets/);
});

test("snapshot invoice menyimpan gambar tanda tangan dan tidak lagi menulis rekening", () => {
  assert.equal(crmActionSource.match(/snapshotSignaturePath: business\?\.signaturePath/g)?.length, 2, "dipakai saat invoice dibuat dan dikunci");
  assert.ok(!crmActionSource.includes("snapshotBankName: business?.bankName"), "perekaman rekening dari profil dihentikan");
});

test("PDF invoice mengikuti template: tanpa blok rekening, dengan gambar tanda tangan", () => {
  const route = invoiceRouteSource;
  assert.match(route, /snapshotSignaturePath: true/);
  assert.match(route, /paymentMethod\.findMany\(\{\s*where: \{ isActive: true \}/s, "hanya metode pembayaran aktif");
  assert.match(route, /\{ logo: logoBytes, signature: signatureBytes, paymentMethods, settingPoints \}/);
  assert.ok(!route.includes("profile?.bankName"), "tidak ada lagi fallback rekening dari profil");

  const pdf = invoicePdfSource;
  // Template tidak punya blok rekening/metode: info bank cukup lewat teks Keterangan.
  assert.doesNotMatch(pdf, /Metode pembayaran/, "blok metode pembayaran dihapus mengikuti template");
  assert.doesNotMatch(pdf, /Rekening pembayaran/, "blok snapshot rekening dihapus mengikuti template");
  assert.match(pdf, /assets\.signature/);
  assert.match(pdf, /scaleToFit\(450, 138\)/, "gambar tanda tangan diskalakan tetap di atas nama");
});

test("PDF kwitansi menampilkan gambar tanda tangan dari snapshot invoice", () => {
  assert.match(receiptRouteSource, /snapshotSignaturePath/);
  assert.match(receiptRouteSource, /normalizePdfImage/);
  assert.match(receiptRouteSource, /readImage\(order\.invoice\.snapshotSignaturePath \?\? profile\?\.signaturePath/);
  assert.match(receiptRouteSource, /\{ logo, signature \}/);
  assert.match(receiptPdfSource, /createReceiptPdf\(data: ReceiptData, assets: ReceiptAssets = \{\}\)/);
  assert.match(receiptPdfSource, /page\.drawImage\(signature/);
});

test("kop invoice & kwitansi jatuh ke profil terkini bila snapshot masih kosong", () => {
  // Invoice lama dibuat sebelum profil perusahaan diisi; kolom snapshot-nya null.
  for (const fallback of [
    "businessName: order.invoice.snapshotBusinessName ?? profile?.name",
    "businessAddress: order.invoice.snapshotBusinessAddress ?? profile?.address",
    "businessPhone: order.invoice.snapshotBusinessPhone ?? profile?.phone",
    "businessEmail: order.invoice.snapshotBusinessEmail ?? profile?.email",
    "signatureName: order.invoice.snapshotSignatureName ?? profile?.signatureName",
  ]) {
    assert.ok(receiptRouteSource.includes(fallback), `route kwitansi harus menjatuhkan ${fallback}`);
  }
  for (const fallback of [
    "invoice.snapshotBusinessName ?? currentBusiness?.name",
    "invoice.snapshotBusinessAddress ?? currentBusiness?.address",
    "invoice.snapshotBusinessPhone ?? currentBusiness?.phone",
    "invoice.snapshotBusinessEmail ?? currentBusiness?.email",
    "invoice.snapshotBusinessLogoPath ?? currentBusiness?.logoPath",
    "invoice.snapshotSignaturePath ?? currentBusiness?.signaturePath",
  ]) {
    assert.ok(invoiceRouteSource.includes(fallback), `route invoice PDF harus menjatuhkan ${fallback}`);
  }
  // Blok Catatan lama diganti poin master "Pengaturan invoice" (live, tanpa snapshot).
  assert.match(invoiceRouteSource, /invoiceSettingPoint\.findMany/);
  assert.doesNotMatch(invoiceRouteSource, /notes: invoice\.notes \?\? profile\?\.invoiceNotes/);
});

test("template kwitansi mengikuti referensi (A5 landscape, kop, empat baris)", () => {
  assert.match(receiptPdfSource, /const W = 595\.28/);
  assert.match(receiptPdfSource, /const H = 420/);
  for (const label of ["KWITANSI", "Payment No. :", "Invoice No. :", "Terima Dari", "Banyaknya Uang", "Untuk pembayaran", "Jumlah Rp"]) {
    assert.ok(receiptPdfSource.includes(label), `template harus memuat teks "${label}"`);
  }
  // Tanggal "02 Okt 2026" dan jumlah "2,165,000.00" sesuai referensi.
  assert.match(receiptPdfSource, /day: "2-digit", month: "short", year: "numeric"/);
  assert.match(receiptPdfSource, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
  assert.match(receiptPdfSource, /function terbilangRupiah/);
  // Kop memakai data snapshot invoice: logo, alamat, telepon, email.
  for (const field of ["snapshotBusinessLogoPath", "snapshotBusinessPhone", "snapshotBusinessEmail"]) {
    assert.match(receiptRouteSource, new RegExp(field), `route kwitansi harus memilih ${field}`);
  }
});
