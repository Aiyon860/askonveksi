import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

const [
  spec,
  loader,
  dataLoader,
  route,
  runner,
  workerClient,
  worker,
  builder,
  button,
  laporan,
  pemasukan,
  pengeluaran,
  schema,
] = await Promise.all([
  readFile(new URL("lib/export/finance-workbook-spec.ts", root), "utf8"),
  readFile(new URL("lib/finance/workbook.ts", root), "utf8"),
  readFile(new URL("lib/finance/expense.ts", root), "utf8"),
  readFile(new URL("app/api/export/finance-workbook/route.ts", root), "utf8"),
  readFile(new URL("lib/export/run-finance-workbook.ts", root), "utf8"),
  readFile(new URL("lib/export/worker-client.ts", root), "utf8"),
  readFile(new URL("public/export-worker.js", root), "utf8"),
  readFile(new URL("lib/export/build-workbook.ts", root), "utf8"),
  readFile(new URL("components/export/export-button.tsx", root), "utf8"),
  readFile(new URL("app/(app)/keuangan/laporan/page.tsx", root), "utf8"),
  readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
  readFile(new URL("app/(app)/keuangan/pengeluaran/page.tsx", root), "utf8"),
  readFile(new URL("prisma/schema.prisma", root), "utf8"),
]);

test("workbook laporan keuangan memakai tujuh sheet dan urutan sesuai template klien", () => {
  assert.match(spec, /name: mode === "project" \? "PROJECT" : "DP"/);
  for (const sheet of ["PENGELUARAN", "SALDO AKHIR", "PNGELUARAN MURNI", "CATATAN"]) {
    assert.match(spec, new RegExp(`name: "${sheet}"`));
  }
  // Typo nama sheet dipertahankan agar cocok dengan file klien, judul di dalam sheet diperbaiki.
  assert.match(spec, /name: "PNGELUARAN MURNI"/);
  assert.match(spec, /Pengeluaran murni \$\{data\.period\.monthTitle\}/);
  assert.match(spec, /data\.scope === "laporan"/);
  assert.match(spec, /\[project\.sheet, expense\.sheet, cash\.sheet, dp\.sheet, pure\.sheet, notes\.sheet, detail\.sheet\]/);
  assert.match(spec, /data\.scope === "pemasukan"/);
  assert.match(spec, /\[project\.sheet, dp\.sheet\]/);
  assert.match(spec, /\[expense\.sheet, cash\.sheet, pure\.sheet, detail\.sheet\]/);
  assert.match(spec, /freeze: \{ row: secondHeaderNumber, column: 2 \}/);
  assert.match(spec, /printTitlesRow: `\$\{groupRow\}:\$\{secondHeaderNumber\}`/);
  assert.match(spec, /fitToPage: true/);
});

test("halaman keuangan memakai workbook dan mempertahankan export sekunder", () => {
  assert.match(laporan, /<ExportButton workbookScope="laporan" params=\{exportParams\} \/>/);
  assert.doesNotMatch(laporan, /dataset="laporan"/);
  assert.match(pengeluaran, /<ExportButton workbookScope="pengeluaran" params=\{exportParams\} \/>/);
  assert.doesNotMatch(pengeluaran, /dataset="pengeluaran"/);
  assert.match(pemasukan, /workbookScope: "pemasukan"/);
  assert.match(pemasukan, /dataset: "mutasi-pembayaran"/);
  assert.match(pemasukan, /dataset: "rincian-hpp"/);
});

test("perhitungan HPP, laba, kas, dan catatan tidak menghitung ganda", () => {
  // Total HPP selalu jumlah komponen; laba/margin hanya saat status HPP Lengkap.
  assert.match(spec, /SUM\(E\$\{rowNumber\}:K\$\{rowNumber\}\)/);
  assert.match(spec, /IF\(U\$\{rowNumber\}="Lengkap",M\$\{rowNumber\}-L\$\{rowNumber\},""\)/);
  assert.match(spec, /SUMIF\(\$\{completeRange\},"Lengkap",\$\{invoiceRange\}\)/);
  assert.match(spec, /MAX\(R\$\{rowNumber\}-P\$\{rowNumber\},0\)/);
  // Saldo akhir: saldo awal bisa diubah, baris berikutnya memakai saldo berjalan.
  assert.match(spec, /SALDO AWAL \(bisa diubah\)/);
  assert.match(spec, /E\$\{rowNumber - 1\}\+C\$\{rowNumber\}-D\$\{rowNumber\}/);
  assert.match(spec, /entries\.length/);
  assert.match(spec, /E\$\{openingRow\}/);
  // Total pengeluaran menjumlah baris tanggal saja (sheet ringkas tanpa baris subtotal).
  assert.match(spec, /sumFormula\("F", 3, rows\.length/);
  // Catatan memisahkan arus kas project dan operasional (sumber: sheet rincian per item).
  assert.match(spec, /'RINCIAN PENGELUARAN'!E:E,"Project"/);
  assert.match(spec, /'RINCIAN PENGELUARAN'!E:E,"Operasional"/);
  assert.match(spec, /B3-B4/);
  assert.match(spec, /B5-B6/);
  // Guard data kosong.
  assert.match(spec, /lastDataRow >= firstDataRow/);
  assert.match(spec, /sumFormula\("C", 4, leftLastDataRow/);
  assert.match(spec, /expenseGroupLabel\(date\)/);
});

test("loader workbook memuat semua project aktif tetapi membatasi kas dan pembayaran per periode", () => {
  assert.match(dataLoader, /getIncomeOrders\(\{ status: "ACTIVE", invoice: \{ status: "ISSUED" \} \}\)/);
  assert.match(dataLoader, /const payment = order\.payment/);
  assert.match(dataLoader, /payment\?\.transactions \?\? \[\]/);
  assert.match(dataLoader, /transaction\.paidAt >= start && transaction\.paidAt < end/);
  assert.match(loader, /function expenseDate\(value: Date\)/);
  assert.match(loader, /expenseDate\(range\.start\)/);
  assert.match(loader, /paidAt: \{ gte: range\.start, lt: range\.end \}/);
  assert.match(loader, /includeProjects/);
  assert.match(loader, /includeExpenses/);
  assert.match(loader, /includePayments/);
  assert.match(loader, /status: "ACTIVE"/);
  assert.match(loader, /invoice: \{ status: "ISSUED" \}/);
  // DP/Project memakai total pembayaran all-time; periode hanya untuk kolom Pembayaran Periode.
  assert.match(loader, /kind: "DEPOSIT" \| "DP" \| "PELUNASAN" \| "PEMBAYARAN"/);
  assert.match(loader, /paymentTermId: true/);
  assert.match(loader, /row\.isDeposit/);
  assert.match(loader, /row\.paymentTermId/);
  assert.match(dataLoader, /payment\.kind !== "LUNAS"/);
  assert.match(dataLoader, /!transaction\.isDeposit && !transaction\.paymentTermId/);
  assert.match(dataLoader, /Boolean\(transaction\.paymentTermId\)/);
  assert.match(schema, /acceptedAt\s+DateTime/);
});

test("route export workbook memakai otorisasi keuangan dan whitelist scope", () => {
  assert.match(route, /getCurrentActor/);
  assert.match(route, /hasRole\(actor\.role, FINANCE_ROLES\)/);
  assert.match(route, /value === "laporan" \|\| value === "pemasukan" \|\| value === "pengeluaran"/);
  assert.match(route, /parseFinanceDateRange/);
  assert.match(route, /getFinanceWorkbookData/);
  assert.match(route, /buildFinanceWorkbookSpec/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /exceljs|writeBuffer/);
  // Hanya tanggal yang memengaruhi workbook, filter tabel lain tidak dibaca.
  assert.doesNotMatch(route, /searchParams\.get\("(q|category|status|method|hppStatus|order|pageSize)"\)/);
});

test("workbook dibangun di Web Worker dengan fallback main thread", () => {
  assert.match(runner, /startWorkbookWorker/);
  assert.match(runner, /buildWorkbookSpec/);
  assert.match(runner, /WorkerUnavailableError/);
  assert.match(runner, /saveBytes/);
  assert.match(runner, /downloadFilename\(payload\.subject, "xlsx"\)/);
  assert.match(runner, /payload\.rowCount === 0/);
  assert.match(workerClient, /startWorkbookWorker/);
  assert.match(workerClient, /init-workbook/);
  assert.match(workerClient, /finish-workbook/);
  assert.match(worker, /message\.type === "init-workbook"/);
  assert.match(worker, /message\.type === "finish-workbook"/);
  assert.match(worker, /applyWorkbookSpec/);
  assert.match(worker, /fullCalcOnLoad/);
  assert.match(builder, /fullCalcOnLoad/);
  assert.match(builder, /fitToPage/);
  assert.match(builder, /writeBuffer/);
});

test("tombol export mendukung workbookScope tanpa merusak dataset lama", () => {
  assert.match(button, /workbookScope\?: FinanceWorkbookScope/);
  assert.match(button, /runFinanceWorkbookExport/);
  assert.match(button, /"workbookScope" in target/);
  assert.match(button, /item\.workbookScope/);
  assert.match(button, /dataset\?: string/);
  assert.match(button, /runExcelExport/);
});
