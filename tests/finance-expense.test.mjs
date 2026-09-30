import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("finance keeps the requested expense methods, feedback, and ownership guards", async () => {
  const [schema, actions, income, expenses, expenseData, migration, incomeExport] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
    readFile(new URL("prisma/migrations/20260923010000_sales_order_costs_and_remove_profit/migration.sql", root), "utf8"),
    readFile(new URL("app/api/keuangan/pemasukan/export/route.ts", root), "utf8"),
  ]);
  for (const method of ["QRIS", "TUNAI", "BANK_A", "BANK_B", "PRIBADI"]) assert.match(schema, new RegExp(`\\b${method}\\b`));
  for (const category of ["WIFI", "LINGKUNGAN", "ADS", "CICILAN_LAPTOP", "FREE_PICK", "ONGKIR_CUST", "ONGKIR_ADMIN_PRODUKSI", "LISTRIK_DEPAN", "LISTRIK_BELAKANG", "PERALATAN_KANTOR", "SAMPEL", "KONTEN", "MEETING", "EVENT_IFANA_SAGA", "GOSEND_MOBIL_PRODUKSI", "LEMBUR", "LOKER", "DLL"]) assert.match(schema, new RegExp(`\\b${category}\\b`));
  assert.match(actions, /current\.createdById !== actor\.id/);
  assert.match(actions, /current\.paymentMethod !== "PRIBADI"/);
  assert.match(actions, /typeof id === "string" && id \? id : undefined/);
  assert.match(actions, /category: z\.enum\(EXPENSE_CATEGORIES\)/);
  assert.match(actions, /flashMessagePath\(PATH, "notice", "Pengeluaran berhasil dicatat\."\)/);
  assert.match(expenses, /<PageMessage \/>/);
  assert.match(expenses, /rowSpan=\{group\.items\.length\}/);
  assert.match(expenses, /<SortableTableHead label="Tanggal"/);
  assert.match(expenses, /EXPENSE_CATEGORY_LABEL\[item\.category\]/);
  assert.match(expenses, /name="category"/);
  assert.match(expenses, /Semua kategori/);
  assert.match(expenses, /range\?\.start \?\? null/);
  assert.match(expenseData, /state\.category === "all" \? \{\} : \{ category: state\.category \}/);
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
