import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("finance keeps expense methods via master data, feedback, ownership guards, and income export", async () => {
  const [schema, actions, income, expenses, expenseData, migration, expenseMethodMigration, exportRoute, exportRegistry, financeDatasets] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("prisma/migrations/20260923010000_sales_order_costs_and_remove_profit/migration.sql", root), "utf8"),
    readFile(new URL("prisma/migrations/20260930010000_expense_payment_method_fk/migration.sql", root), "utf8"),
    readFile(new URL("app/api/export/[dataset]/route.ts", root), "utf8"),
    readFile(new URL("lib/export/registry.ts", root), "utf8"),
    readFile(new URL("lib/export/datasets/finance.ts", root), "utf8"),
  ]);
  // Metode pembayaran pengeluaran kini memakai Data Master, bukan enum hardcoded.
  assert.match(schema, /paymentMethodId\s+String/);
  assert.match(schema, /isReimbursable\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /paymentMethod\s+PaymentMethod\s+@relation\(fields: \[paymentMethodId\]/);
  assert.doesNotMatch(schema, /enum ExpensePaymentMethod/);
  assert.match(expenseMethodMigration, /isReimbursable" = true WHERE "paymentMethod" = 'PRIBADI'/);
  assert.match(expenseMethodMigration, /Expense_paymentMethodId_fkey/);
  for (const category of ["WIFI", "LINGKUNGAN", "ADS", "CICILAN_LAPTOP", "FREE_PICK", "ONGKIR_CUST", "ONGKIR_ADMIN_PRODUKSI", "LISTRIK_DEPAN", "LISTRIK_BELAKANG", "PERALATAN_KANTOR", "SAMPEL", "KONTEN", "MEETING", "EVENT_IFANA_SAGA", "GOSEND_MOBIL_PRODUKSI", "LEMBUR", "LOKER", "DLL"]) assert.match(schema, new RegExp(`\\b${category}\\b`));
  assert.match(actions, /current\.createdById !== actor\.id/);
  assert.match(actions, /!current\.isReimbursable/);
  assert.match(actions, /paymentMethodId: z\.string\(\)\.trim\(\)\.min\(1/);
  assert.match(actions, /typeof id === "string" && id \? id : undefined/);
  assert.match(actions, /category: z\.enum\(EXPENSE_CATEGORIES\)/);
  assert.match(actions, /flashMessagePath\(PATH, "notice", "Pengeluaran berhasil dicatat\."\)/);
  assert.match(expenses, /<PageMessage \/>/);
  assert.match(expenses, /rowSpan=\{totalRows\}/);
  // Baris Project dikelompokkan per order di dalam grup tanggal, lengkap dengan subtotal.
  assert.match(expenses, /group\.operasional/);
  assert.match(expenses, /group\.projects/);
  assert.match(expenses, /Project: \{project\.label\}/);
  assert.match(expenses, /project\.subtotal/);
  assert.match(expenseData, /projectGroupLabel/);
  assert.match(expenseData, /salesOrderId \?\? "none"/);
  // Route data menyajikan JSON halaman; kolom ada di dataset server dan file .xlsx dibuat di browser.
  assert.match(exportRoute, /Response\.json/);
  assert.match(exportRoute, /EXPORT_DATASETS\[dataset\]/);
  assert.doesNotMatch(exportRoute, /exceljs|writeBuffer/);
  assert.doesNotMatch(financeDatasets, /exceljs|writeBuffer/);
  assert.match(exportRegistry, /loadPengeluaran/);
  assert.match(financeDatasets, /"Project"/);
  assert.match(financeDatasets, /subtotal per project/i);
  // Revisi: kolom Deskripsi (Expense.description per baris) di tabel & export, sebelum Status Ganti.
  assert.ok(expenses.indexOf("<TableHead>Deskripsi</TableHead>") !== -1, "header tabel pengeluaran punya Deskripsi");
  assert.ok(expenses.indexOf("<TableHead>Deskripsi</TableHead>") < expenses.indexOf("<TableHead>Status Ganti</TableHead>"), "Deskripsi sebelum Status Ganti");
  assert.match(expenses, /\{item\.description \|\| "-"\}/);
  assert.ok(financeDatasets.indexOf('header: "Nominal"') !== -1 && financeDatasets.indexOf('header: "Nominal"') < financeDatasets.indexOf('header: "Deskripsi"'), "Nominal sebelum Deskripsi");
  assert.ok(financeDatasets.indexOf('header: "Deskripsi"') < financeDatasets.indexOf('header: "Status Ganti"'), "Deskripsi sebelum Status Ganti");
  assert.match(financeDatasets, /item\.description \?\? ""/);
  assert.match(expenseData, /purpose: true, description: true, spentAt: true/);
  assert.match(expenses, /<SortableTableHead label="Tanggal"/);
  assert.match(expenses, /EXPENSE_CATEGORY_LABEL\[item\.category\]/);
  assert.match(expenses, /name="category"/);
  assert.match(expenses, /Semua kategori/);
  assert.match(expenses, /range\?\.start \?\? null/);
  assert.match(expenseData, /state\.category === "all" \? \{\} : \{ category: state\.category \}/);
  assert.match(expenseData, /paymentMethodId: state\.method/);
  assert.match(expenseData, /getExpensesForExport/);
  assert.match(expenseData, /value\.getTime\(\) \+ 7 \* 60 \* 60 \* 1000/);
  assert.match(expenseData, /groupBy\(\{ by: \["spentAt"\]/);
  assert.match(expenseData, /spentAt: (bounded|state)\.order/);
  // Ekspor memakai jendela default yang sama dengan tabel (90 hari) saat tanpa filter.
  assert.equal(expenseData.match(/!state\.from && !state\.to/g)?.length, 2, "getExpenses & getExpensesForExport sama-sama menerapkan jendela default");
  for (const column of ["Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain", "Total HPP", "Harga Asli", "Laba Bersih", "Margin", "Diskon", "Total Invoice", "DP", "Lunas", "Status"]) assert.match(income, new RegExp(column));
  // Harga Asli = subtotal invoice (harga sebelum diskon), posisinya di antara Total HPP dan Diskon.
  assert.match(expenseData, /invoice: \{ select: \{ subtotal: true,/);
  assert.match(expenseData, /originalPrice: order\.invoice\.subtotal\.toString\(\)/);
  assert.ok(income.indexOf("\"Total HPP\", \"Harga Asli\", \"Diskon\"") !== -1, "kolom Harga Asli berada di antara Total HPP dan Diskon");
  assert.ok(income.indexOf("item.hpp, item.originalPrice, item.discount") !== -1, "sel memakai subtotal invoice sebelum diskon");
  const projectColumns = financeDatasets.slice(financeDatasets.indexOf("PROJECT_COLUMNS"), financeDatasets.indexOf("export async function loadProject"));
  assert.ok(projectColumns.indexOf('header: "Total HPP"') < projectColumns.indexOf('header: "Harga Asli"') && projectColumns.indexOf('header: "Harga Asli"') < projectColumns.indexOf('header: "Diskon"'), "export memakai urutan kolom yang sama");
  assert.match(financeDatasets, /Number\(item\.originalPrice\)/);
  // Label persen cukup di header kolom; sel hanya menampilkan angkanya.
  assert.match(income, /"Margin %"/);
  assert.doesNotMatch(income, /from "lucide-react"[^\n]*Percent/);
  assert.doesNotMatch(income, /<Percent/);
  assert.match(actions, /updateSalesOrderCostAction/);
  assert.match(actions, /requireActor\(FINANCE_ROLES\)/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "InvoiceItem_charges_valid"/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "SalesOrderItem_values_valid"/);
  assert.match(migration, /"profitPercent" = 0 AND "profitAmount" = 0/);
});

test("R18: Keperluan pengeluaran HPP tanpa nomor invoice (baru & data lama dibersihkan)", async () => {
  const actions = await readFile(new URL("app/actions/finance.ts", root), "utf8");
  const backfill = await readFile(new URL("prisma/migrations/20261017010000_expense_purpose_drop_invoice_no/migration.sql", root), "utf8");

  // Alur Edit HPP baru: purpose berhenti di nama produk, tanpa segmen invoice.
  assert.match(actions, /purpose: `HPP \$\{HPP_LABEL\[plan\.key\] \?\? plan\.key\} · \$\{customerName\} · \$\{order\.purchaseOrder\.productName\}`/);
  assert.doesNotMatch(actions, /purpose: `HPP [^`]*invoiceNo/);
  // Data lama (termasuk Riwayat Hapus) dibersihkan sekali jalan oleh migrasi backfill.
  assert.match(backfill, /UPDATE "Expense"/);
  assert.match(backfill, /regexp_replace\(purpose, ' · INV-\[\^·\]\*\$', ''\)/);
});

test("R15-R17: Edit HPP multi-baris, in-place reconcile, kolom Deskripsi", async () => {
  const [schema, migration, actions, form, expenseData, page, financeDatasets, xlsxBuilder] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("prisma/migrations/20261019020000_expense_description/migration.sql", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("components/finance/sales-order-cost-form.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("lib/export/datasets/finance.ts", root), "utf8"),
    readFile(new URL("lib/export/build-xlsx.ts", root), "utf8"),
  ]);

  // Skema + migrasi kolom description.
  assert.match(schema, /description\s+String\?/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "description"/);

  // Server: batas baris, skema multi-baris, reconcile in-place tanpa massal soft-delete.
  assert.match(actions, /const HPP_ROW_LIMIT = 12/);
  assert.match(actions, /const hppRowSchema = z\.object\(/);
  assert.match(actions, /kain: z\.array\(hppRowSchema\)\.max\(HPP_ROW_LIMIT/);
  assert.match(actions, /function readHppRows\(formData: FormData, key/);
  assert.match(actions, /formData\.getAll\("removedId"\)/);
  assert.doesNotMatch(actions, /Digantikan sinkronisasi HPP terbaru/);
  assert.doesNotMatch(actions, /tx\.expense\.updateMany\(\{ where: \{ salesOrderId, category: "PROJECT"/);
  assert.match(actions, /Dihapus dari form Edit HPP\./);
  assert.match(actions, /action: "EXPENSE_UPDATED"/);
  assert.match(actions, /revalidatePath\("\/keuangan\/pengeluaran\/riwayat"\)/);

  // Form: baris dinamis per jenis, tombol tambah/hapus, hidden removedId, Deskripsi per baris.
  assert.match(form, /const HPP_ROW_LIMIT = 12/);
  assert.match(form, /Tambah baris/);
  assert.match(form, /name=\{`amount_\$\{name\}_\$\{index\}`\}/);
  assert.match(form, /name=\{`id_\$\{name\}_\$\{index\}`\}/);
  assert.match(form, /name=\{`description_\$\{name\}_\$\{index\}`\}/);
  assert.match(form, /name=\{`proof_\$\{name\}_\$\{index\}`\}/);
  assert.match(form, /name="removedId"/);
  assert.match(form, /Bukti TF \(opsional\)/);

  // Prefill semua baris (array per jenis), bukan baris pertama saja.
  assert.match(expenseData, /hppProjectDescription/);
  assert.match(expenseData, /orderBy: \{ createdAt: "asc" \}/);
  assert.match(page, /HppProjectPrefill\[\]/);
  assert.match(page, /hppProjectDescription\(/);

  // R17: kolom Deskripsi di tabel dan export, di antara Lain-lain dan Total HPP.
  assert.ok(page.indexOf("\"Lain-lain\"") < page.indexOf("<TableHead>Deskripsi</TableHead>"), "Deskripsi setelah Lain-lain di header");
  assert.ok(page.indexOf("<TableHead>Deskripsi</TableHead>") < page.indexOf("\"Total HPP\""), "Deskripsi sebelum Total HPP di header");
  const projectColumnBlock = financeDatasets.slice(financeDatasets.indexOf("PROJECT_COLUMNS"), financeDatasets.indexOf("export async function loadProject"));
  assert.ok(projectColumnBlock.indexOf('header: "Lain-lain"') < projectColumnBlock.indexOf('header: "Deskripsi"') && projectColumnBlock.indexOf('header: "Deskripsi"') < projectColumnBlock.indexOf('header: "Total HPP"'), "export: Deskripsi di antara Lain-lain dan Total HPP");

  // Revisi — Deskripsi multi-baris per pengeluaran: "Kain 1 (Rp …): desc" dipisah newline.
  assert.match(expenseData, /join\("\\n"\)/);
  assert.match(expenseData, /\$\{HPP_ROW_LABEL\[key\]\} \$\{sequence\} \(\$\{amount\}\): \$\{row\.description\}/);
  assert.match(page, /whitespace-pre-line/);
  assert.match(xlsxBuilder, /wrapText: true/);

  // Revisi — Status = switch manual hppComplete; Total HPP dihitung saat true (null = 0).
  const [switchSource, schemaHpp, migrationHpp] = await Promise.all([
    readFile(new URL("components/finance/hpp-complete-switch.tsx", root), "utf8"),
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("prisma/migrations/20261020010000_sales_order_cost_hpp_complete/migration.sql", root), "utf8"),
  ]);
  assert.match(schemaHpp, /hppComplete\s+Boolean\s+@default\(false\)/);
  assert.match(migrationHpp, /ADD COLUMN IF NOT EXISTS "hppComplete"/);
  assert.match(migrationHpp, /SET "hppComplete" = true/);
  assert.match(actions, /toggleHppCompleteAction/);
  assert.match(actions, /action: "HPP_COMPLETE_TOGGLED"/);
  assert.match(switchSource, /toggleHppCompleteAction/);
  assert.match(expenseData, /Boolean\(costs\?\.hppComplete\)/);
  assert.match(expenseData, /hppComplete: costs\?\.hppComplete \?\? false/);
  assert.match(expenseData, /hppComplete: true/);
  assert.doesNotMatch(expenseData, /every\(\(value\) => value !== null\)\)/);
  assert.match(page, /HppCompleteSwitch/);
  assert.match(page, /whitespace-pre-line/);
});

test("semua export Excel dibuat 100% di browser lewat Web Worker", async () => {
  const [route, registry, financeDatasets, page, expenseData, button, runner, workerClient, worker, builder, toastView] = await Promise.all([
    readFile(new URL("app/api/export/[dataset]/route.ts", root), "utf8"),
    readFile(new URL("lib/export/registry.ts", root), "utf8"),
    readFile(new URL("lib/export/datasets/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("components/export/export-button.tsx", root), "utf8"),
    readFile(new URL("lib/export/run-export.ts", root), "utf8"),
    readFile(new URL("lib/export/worker-client.ts", root), "utf8"),
    readFile(new URL("public/export-worker.js", root), "utf8"),
    readFile(new URL("lib/export/build-xlsx.ts", root), "utf8"),
    readFile(new URL("components/ui/toast.tsx", root), "utf8"),
  ]);
  // Route data saja — tidak ada exceljs / writeBuffer / Content-Disposition di server.
  assert.match(route, /Response\.json/);
  assert.doesNotMatch(route, /exceljs|writeBuffer|Content-Disposition/);
  assert.match(route, /nextOffset/);
  assert.doesNotMatch(registry, /exceljs|writeBuffer/);
  // Setiap dataset mendeklarasikan judul, sheet, subjek file, kolom, dan loader.
  assert.match(registry, /title: "Pengeluaran"/);
  assert.match(registry, /subject: "pengeluaran"/);
  assert.match(registry, /loadPengeluaran/);
  // Tombol klien: toast loading -> progres -> success, lalu unduh otomatis.
  assert.match(button, /"use client"/);
  assert.match(button, /Sedang mengexport Excel/);
  assert.match(button, /Export Excel selesai/);
  assert.match(button, /toast\.update\(toastId/);
  assert.match(button, /timeout: 0/);
  // Progres persen + tombol Batalkan (AbortController) di toast export.
  assert.match(button, /AbortController/);
  assert.match(button, /children: "Batalkan"/);
  assert.match(button, /controller\.abort\(\)/);
  assert.match(button, /progress\.percent/);
  assert.match(button, /Export dibatalkan/);
  assert.match(button, /signal: controller\.signal/);
  assert.match(button, /actionProps: \{\}/);
  // Toast merender aksi opsional yang dikirim lewat actionProps.
  assert.match(toastView, /ToastPrimitive\.Action/);
  assert.match(toastView, /item\.actionProps/);
  // Orkestrasi: ambil halaman JSON bertahap, bangun file di worker, unduh blob.
  assert.match(runner, /startExcelWorker/);
  assert.match(runner, /EXPORT_PAGE_SIZE/);
  assert.match(runner, /ExportCancelledError/);
  assert.match(runner, /signal\?: AbortSignal/);
  assert.match(runner, /percent: percentOf/);
  assert.match(runner, /URL\.createObjectURL/);
  assert.match(runner, /downloadFilename\(first\.subject, "xlsx"\)/);
  assert.match(workerClient, /new Worker\("\/export-worker\.js"\)/);
  assert.match(worker, /importScripts\("\/vendor\/exceljs\.min\.js"\)/);
  assert.match(worker, /message\.type === "finish"/);
  assert.match(builder, /await import\("exceljs"\)/);
  assert.match(builder, /wrapText: true/);
  // Halaman memakai tombol klien, filter export = filter tabel (+ sort aktif).
  assert.match(page, /<ExportButton workbookScope="pengeluaran" params=\{exportParams\} \/>/);
  assert.match(page, /order: order === "desc" \? undefined : order/);
  // Ekspor membawa jendela default yang sama dengan tabel + paging tanpa cap.
  assert.match(expenseData, /const bounded = !state\.from && !state\.to/);
  assert.match(expenseData, /skip: page\.offset, take: page\.limit/);
  assert.doesNotMatch(expenseData, /EXPENSE_EXPORT_LIMIT/);
  assert.match(financeDatasets, /subtotal per project/i);
});

test("export Laporan memuat 4 ringkasan total dengan format rupiah", async () => {
  const source = await readFile(new URL("lib/export/datasets/finance.ts", root), "utf8");
  // Kartu ringkasan halaman ikut terexport, bukan hanya baris detail.
  assert.match(source, /Total Pemasukan Keseluruhan/);
  assert.match(source, /Total Pengeluaran Keseluruhan/);
  assert.match(source, /Total Pendapatan \$\{periodLabel\}/);
  assert.match(source, /Total Pengeluaran \$\{periodLabel\}/);
  // Nilai memakai format rupiah (Rp 150.000), bukan "Rp 150000" mentah.
  assert.match(source, /formatCurrency\(group\.income\[index\]\.amount\)/);
  // Pengeluaran dicetak satu baris per tanggal memakai total hariannya.
  assert.match(source, /expenseGroupLabel\(group\.date\)/);
  assert.match(source, /formatCurrency\(group\.expenseTotal\)/);
  assert.match(source, /formatCurrency\(report\.allIncome\)/);
  assert.match(source, /formatCurrency\(report\.totalExpense\)/);
  assert.doesNotMatch(source, /— Rp \$\{/);
});

test("export Excel tidak menyertakan gambar di semua endpoint (R14)", async () => {
  const files = [
    "app/api/export/[dataset]/route.ts",
    "lib/export/registry.ts",
    "lib/export/datasets/finance.ts",
    "lib/export/datasets/crm.ts",
    "lib/export/datasets/orders.ts",
    "lib/export/datasets/hr.ts",
    "lib/export/datasets/master.ts",
    "lib/export/build-xlsx.ts",
    "public/export-worker.js",
    "lib/export/worker-client.ts",
    "lib/export/run-export.ts",
    "components/export/export-button.tsx",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /addImage|data:image\/|base64,/, `${file} tidak memuat gambar`);
  }
});
