import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("finance keeps the requested expense methods, feedback, and ownership guards", async () => {
  const [schema, actions, income, expenses, expenseData] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
    readFile(new URL("lib/finance/expense.ts", root), "utf8"),
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
  assert.match(expenseData, /spentAt: state\.order/);
  for (const column of ["Total HPP", "Laba Bersih", "Laba Kotor", "Margin", "Diskon", "Total Invoice", "DP", "Lunas"]) assert.match(income, new RegExp(column));
});
