import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("finance keeps expense methods via master data, feedback, ownership guards, and income export", async () => {
  const [schema, actions, income, expenses, expenseData, migration, expenseMethodMigration, incomeExport, expenseExport] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("prisma/migrations/20260923010000_sales_order_costs_and_remove_profit/migration.sql", root), "utf8"),
    readFile(new URL("prisma/migrations/20260930010000_expense_payment_method_fk/migration.sql", root), "utf8"),
    readFile(new URL("app/api/keuangan/pemasukan/export/route.ts", root), "utf8"),
    readFile(new URL("app/api/keuangan/pengeluaran/export/route.ts", root), "utf8"),
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
  assert.match(expenseExport, /"Project"/);
  assert.match(expenseExport, /Subtotal Project:/);
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
  for (const column of ["Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain", "Total HPP", "Harga Asli", "Laba Bersih", "Margin", "Diskon", "Total Invoice", "DP", "Lunas", "Status"]) assert.match(income, new RegExp(column));
  // Harga Asli = subtotal invoice (harga sebelum diskon), posisinya di antara Total HPP dan Diskon.
  assert.match(expenseData, /invoice: \{ select: \{ subtotal: true,/);
  assert.match(expenseData, /originalPrice: order\.invoice\.subtotal\.toString\(\)/);
  assert.ok(income.indexOf("\"Total HPP\", \"Harga Asli\", \"Diskon\"") !== -1, "kolom Harga Asli berada di antara Total HPP dan Diskon");
  assert.ok(income.indexOf("item.hpp, item.originalPrice, item.discount") !== -1, "sel memakai subtotal invoice sebelum diskon");
  assert.ok(incomeExport.indexOf("\"Total HPP\", \"Harga Asli\", \"Diskon\"") !== -1, "export memakai urutan kolom yang sama");
  assert.match(incomeExport, /\"Harga Asli\": Number\(row\.originalPrice\)/);
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
  const [schema, migration, actions, form, expenseData, page, incomeExport] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("prisma/migrations/20261019020000_expense_description/migration.sql", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("components/finance/sales-order-cost-form.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("app/api/keuangan/pemasukan/export/route.ts", root), "utf8"),
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
  assert.ok(incomeExport.indexOf("\"Lain-lain\", \"Deskripsi\", \"Total HPP\"") !== -1, "export: Deskripsi di antara Lain-lain dan Total HPP");

  // Revisi — Deskripsi multi-baris per pengeluaran: "Kain 1 (Rp …): desc" dipisah newline.
  assert.match(expenseData, /join\("\\n"\)/);
  assert.match(expenseData, /\$\{HPP_ROW_LABEL\[key\]\} \$\{sequence\} \(\$\{amount\}\): \$\{row\.description\}/);
  assert.match(page, /whitespace-pre-line/);
  assert.match(incomeExport, /wrapText: true/);

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
