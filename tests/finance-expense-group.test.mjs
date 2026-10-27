import assert from "node:assert/strict";
import test from "node:test";

import { buildFinanceWorkbookSpec } from "../lib/export/finance-workbook-spec.ts";
import { expenseGroupLabel } from "../lib/finance/expense-group-label.ts";

// Permintaan klien: pengeluaran pada tanggal yang sama digabung menjadi satu baris
// "Pengeluaran tanggal 1 Oktober 2026" berisi total harian — di halaman laporan
// maupun di Excel. Test ini mengunci teks label dan memastikan tidak ada angka
// yang hilang atau terhitung dua kali saat penggabungan.

test("label grup pengeluaran memakai tanggal panjang bahasa Indonesia", () => {
  assert.equal(expenseGroupLabel("2026-10-01"), "Pengeluaran tanggal 1 Oktober 2026");
  assert.equal(expenseGroupLabel("2026-10-31"), "Pengeluaran tanggal 31 Oktober 2026");
  // Pergantian bulan dan tahun tidak boleh bergeser gara-gara zona waktu.
  assert.equal(expenseGroupLabel("2026-12-31"), "Pengeluaran tanggal 31 Desember 2026");
  assert.equal(expenseGroupLabel("2027-01-01"), "Pengeluaran tanggal 1 Januari 2027");
});

const period = {
  from: "2026-10-01",
  to: "2026-10-31",
  fromLabel: "01 Oktober 2026",
  toLabel: "31 Oktober 2026",
  label: "01 Oktober 2026 – 31 Oktober 2026",
  rangeLabel: "01 S/D 31 OKTOBER 2026",
  monthLabel: "OKTOBER 2026",
  monthTitle: "Oktober 2026",
  endDateLabel: "31 Oktober 2026",
};

function expense(id, spentAt, purpose, amount, category = "OPERASIONAL") {
  return {
    id,
    spentAt,
    purpose,
    description: "",
    category,
    categoryLabel: category === "PROJECT" ? "Project" : "Operasional",
    kind: category === "PROJECT" ? "PROJECT" : "OPERASIONAL",
    amount,
    customerProject: "-",
    reference: "-",
    method: "Transfer",
    proof: "-",
    createdBy: "Owner",
    createdAt: `${spentAt}T00:00:00.000Z`,
  };
}

const data = {
  scope: "laporan",
  period,
  projects: [],
  expenses: [
    expense("e1", "2026-10-01", "Air kantor", 100000),
    expense("e2", "2026-10-01", "Listrik", 200000),
    expense("e3", "2026-10-01", "Galon Minum", 50000),
    expense("e4", "2026-10-02", "Sewa tempat", 300000),
  ],
  payments: [],
  categories: [],
  generatedAt: "25 Oktober 2026, 10.00 WIB",
};

function cellValue(cell) {
  if (!cell || cell.value === undefined || cell.value === null) return null;
  return typeof cell.value === "object" ? cell.value.result : cell.value;
}

function cellFormula(cell) {
  return cell && typeof cell.value === "object" && cell.value !== null ? cell.value.formula : null;
}

function sheetOf(name) {
  const sheet = buildFinanceWorkbookSpec(data).spec.sheets.find((item) => item.name === name);
  assert.ok(sheet, `sheet ${name} tidak ditemukan`);
  return sheet;
}

test("sheet PENGELUARAN memuat satu baris per tanggal dengan total harian", () => {
  const sheet = sheetOf("PENGELUARAN");
  const dateRows = sheet.rows.filter((row) => String(cellValue(row.cells[1]) ?? "").startsWith("Pengeluaran tanggal"));
  assert.equal(dateRows.length, 2, "tiga pengeluaran pada tanggal yang sama harus jadi satu baris");

  const first = dateRows[0];
  assert.equal(cellValue(first.cells[1]), "Pengeluaran tanggal 1 Oktober 2026");
  assert.equal(cellValue(first.cells[5]), 350000);
  assert.equal(cellValue(first.cells[10]), "Air kantor, Listrik, Galon Minum");

  const second = dateRows[1];
  assert.equal(cellValue(second.cells[1]), "Pengeluaran tanggal 2 Oktober 2026");
  assert.equal(cellValue(second.cells[5]), 300000);

  // Total periode tetap menjumlah semua baris tanggal, bukan sebagian.
  const total = sheet.rows.find((row) => cellValue(row.cells[1]) === "TOTAL PENGELUARAN");
  assert.ok(total, "baris TOTAL PENGELUARAN harus ada");
  assert.equal(cellValue(total.cells[5]), 650000);
  assert.match(cellFormula(total.cells[5]), /^SUM\(/);
});

test("rincian per item tetap tersimpan di sheet RINCIAN PENGELUARAN", () => {
  const sheet = sheetOf("RINCIAN PENGELUARAN");
  const itemRows = sheet.rows.filter((row) => ["Air kantor", "Listrik", "Galon Minum", "Sewa tempat"].includes(cellValue(row.cells[1])));
  assert.equal(itemRows.length, 4, "semua pengeluaran harus tetap tercetak per item");
  const amounts = itemRows.map((row) => cellValue(row.cells[5]));
  assert.deepEqual(amounts, [100000, 200000, 50000, 300000]);
});

test("sheet PNGELUARAN MURNI juga ringkas satu baris per tanggal", () => {
  const sheet = sheetOf("PNGELUARAN MURNI");
  const dateRows = sheet.rows.filter((row) => String(cellValue(row.cells[1]) ?? "").startsWith("Pengeluaran tanggal"));
  assert.equal(dateRows.length, 2);
  assert.equal(cellValue(dateRows[0].cells[2]), 350000);
  assert.equal(cellValue(dateRows[1].cells[2]), 300000);
});

test("total semua grup tanggal sama dengan total seluruh pengeluaran", () => {
  const sheet = sheetOf("PENGELUARAN");
  const dateRows = sheet.rows.filter((row) => String(cellValue(row.cells[1]) ?? "").startsWith("Pengeluaran tanggal"));
  const grouped = dateRows.reduce((sum, row) => sum + Number(cellValue(row.cells[5]) ?? 0), 0);
  const expected = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(grouped, expected);
});
