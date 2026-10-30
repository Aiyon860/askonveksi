import assert from "node:assert/strict";
import test from "node:test";

import { assignSaldoPayments, parseSaldoDate } from "../scripts/saldo-tanggal.mjs";

test("tanggal saldo membaca singkatan Agst", () => {
  assert.equal(parseSaldoDate("Jumat, 1 Agst", 2025), "2025-08-01");
  assert.equal(parseSaldoDate("Sabtu, 12 September 2026", 2026), "2026-09-12");
});

test("dua order Moza dapat tanggal pelunasan masing-masing", () => {
  const orders = [
    { id: "satu", name: "Kak Moza (Rompi Orderan 1)", month: "2025-08", paid: 2_570_000 },
    { id: "dua", name: "Kak Moza (Rompi Orderan 2)", month: "2025-08", paid: 930_000 },
  ];
  const inflows = [
    { date: "2025-08-01", amount: 1_285_000, label: "DP rompi kak moza" },
    { date: "2025-08-12", amount: 480_000, label: "DP orderan ke 2 (moza)" },
    { date: "2025-08-19", amount: 1_285_000, label: "Pelunasan kak moza (orderan 1)" },
    { date: "2025-08-28", amount: 450_000, label: "pelunasan kak moza" },
  ];
  const result = assignSaldoPayments(orders, inflows);
  const first = result.matched.find((item) => item.id === "satu");
  const second = result.matched.find((item) => item.id === "dua");
  assert.equal(first.mode, "exact");
  assert.deepEqual(first.payments.map((row) => row.date), ["2025-08-01", "2025-08-19"]);
  assert.equal(second.payments.reduce((sum, row) => sum + row.amount, 0), 930_000);
});

test("KOV Koffie tidak mengambil pelunasan KOV Heritage", () => {
  const result = assignSaldoPayments(
    [{ id: "koffie", name: "KOV Koffie", month: "2026-08", paid: 1_545_000 }],
    [{ date: "2026-09-04", amount: 1_545_000, label: "Pelunasan KOV Heritage" }],
  );
  assert.equal(result.matched.length, 0);
});

test("baris milik orang lain tidak menempel ke nama yang hanya mirip", () => {
  const result = assignSaldoPayments(
    [
      { id: "sula", name: "KOV SULA (Kak Ikha)", month: "2026-05", paid: 3_150_000, invoice: 3_150_000 },
      { id: "moza", name: "Kak Moza (Rompi Orderan 1)", month: "2025-08", paid: 1_285_000, invoice: 2_570_000 },
    ],
    [
      { date: "2026-06-11", amount: 2_215_000, label: "DP kak farras SULA" },
      { date: "2025-08-01", amount: 1_285_000, label: "DP rompi kak moza" },
      { date: "2025-08-12", amount: 480_000, label: "DP orderan ke 2 (moza)" },
    ],
    ["Kak Farras"],
  );
  assert.equal(result.matched.find((item) => item.id === "sula"), undefined);
  const moza = result.matched.find((item) => item.id === "moza");
  assert.ok(moza);
  assert.deepEqual(moza.payments.map((row) => row.label), ["DP rompi kak moza"]);
});

test("Kak Abyan masuk pada tanggal DP dan tidak diambil order Undip lain", () => {
  const result = assignSaldoPayments(
    [
      { id: "abyan", name: "Kak Abyan", month: "2026-09", paid: 13_270_000, invoice: 13_270_000 },
      { id: "undip", name: "Law Fair Undip", month: "2026-09", paid: 21_156_000, invoice: 21_156_000 },
    ],
    [
      { date: "2026-09-18", amount: 6_594_500, label: "DP Kak Abyan undip" },
      { date: "2026-09-24", amount: 5_405_000, label: "DP ke 2 kak abyan" },
      { date: "2026-09-15", amount: 10_583_000, label: "DP Law Fair" },
    ],
  );
  const abyan = result.matched.find((item) => item.id === "abyan");
  assert.equal(abyan.payments[0].date, "2026-09-18");
  assert.equal(abyan.payments.reduce((sum, row) => sum + row.amount, 0), 11_999_500);
  const undip = result.matched.find((item) => item.id === "undip");
  assert.ok(!undip || undip.payments.every((row) => !row.label.toLocaleLowerCase("id-ID").includes("abyan")));
});

test("DP yang belum lunas di saldo tidak dipaksa tanggal 1", () => {
  const result = assignSaldoPayments(
    [{ id: "glow", name: "Skin Glow Abadi", month: "2026-09", paid: 9_385_000 }],
    [
      { date: "2026-09-11", amount: 100_000, label: "Deposit ELS Skinglow" },
      { date: "2026-09-12", amount: 4_692_500, label: "DP Skin glow abadi" },
    ],
  );
  assert.equal(result.matched[0].mode, "partial");
  assert.equal(result.matched[0].payments.reduce((sum, row) => sum + row.amount, 0), 4_792_500);
});

test("nama pendek tidak mengambil nama yang lebih panjang", () => {
  const result = assignSaldoPayments(
    [
      { id: "ali", name: "Kak Ali", month: "2026-09", paid: 2_170_000, invoice: 2_170_000 },
      { id: "alia", name: "Kak Alia", month: "2026-05", paid: 5_082_000, invoice: 5_082_000 },
    ],
    [
      { date: "2026-09-28", amount: 1_090_000, label: "DP Kak ali" },
      { date: "2026-05-11", amount: 2_591_000, label: "DP Kak Alia" },
    ],
  );
  assert.equal(result.matched.find((item) => item.id === "ali").payments[0].date, "2026-09-28");
  assert.equal(result.matched.find((item) => item.id === "alia").payments[0].amount, 2_591_000);
});

test("beberapa invoice satu pelanggan dibagi dari baris saldo yang sama", () => {
  const result = assignSaldoPayments(
    [
      { id: "polo", name: "Kak Cantika USM", month: "2026-09", paid: 4_880_000, invoice: 4_880_000 },
      { id: "kaos", name: "Kak Cantika USM", month: "2026-09", paid: 2_540_000, invoice: 2_540_000 },
    ],
    [
      { date: "2026-09-04", amount: 100_000, label: "Deposit kak cantika" },
      { date: "2026-09-07", amount: 2_390_000, label: "DP Kak cantika" },
      { date: "2026-09-10", amount: 1_270_000, label: "DP Kaos kak cantika USM" },
      { date: "2026-09-11", amount: 3_660_000, label: "Pelunasan kaos & polo cantika USM" },
    ],
  );
  const polo = result.matched.find((item) => item.id === "polo");
  const kaos = result.matched.find((item) => item.id === "kaos");
  assert.equal(polo.payments[0].date, "2026-09-04");
  assert.equal(kaos.payments[0].date, "2026-09-11");
  assert.equal([...polo.payments, ...kaos.payments].reduce((sum, row) => sum + row.amount, 0), 7_420_000);
});

test("ejaan dikki tetap menempel ke Kak Diki", () => {
  const result = assignSaldoPayments(
    [{ id: "diki", name: "Kak Diki", month: "2026-09", paid: 2_180_000, invoice: 2_180_000 }],
    [{ date: "2026-09-26", amount: 1_090_000, label: "DP Kak dikki" }],
  );
  assert.equal(result.matched[0].payments[0].date, "2026-09-26");
  assert.equal(result.matched[0].payments[0].amount, 1_090_000);
});

test("DP di bulan sebelumnya menjadi tanggal order", () => {
  const result = assignSaldoPayments(
    [{ id: "virgin", name: "Virgin", month: "2026-09", paid: 4_683_000, invoice: 4_683_000 }],
    [{ date: "2026-08-28", amount: 4_683_000, label: "DP Virgin" }],
  );
  assert.equal(result.matched[0].payments[0].date, "2026-08-28");
  assert.equal(result.matched[0].payments[0].amount, 4_683_000);
});

test("selisih kecil di saldo tetap memakai tanggal DP", () => {
  const result = assignSaldoPayments(
    [{ id: "fair", name: "Law Fair Undip", month: "2025-10", paid: 21_156_000, invoice: 21_156_000 }],
    [
      { date: "2025-10-15", amount: 10_583_000, label: "DP Law Fair" },
      { date: "2025-10-23", amount: 10_580_500, label: "Pelunasan Law Fair" },
    ],
  );
  assert.equal(result.matched[0].payments[0].date, "2025-10-15");
  assert.equal(result.matched[0].payments.reduce((sum, row) => sum + row.amount, 0), 21_156_000);
});

test("Julia tidak mengambil baris project Juli", () => {
  const result = assignSaldoPayments(
    [{ id: "julia", name: "Kak Julia", month: "2025-08", paid: 1_850_000, invoice: 1_850_000 }],
    [{ date: "2025-08-06", amount: 500_000, label: "Project Juli (kacamata)" }],
  );
  assert.equal(result.matched.length, 0);
});

test("DP yang menyebut produk Jeep tetap milik Julia", () => {
  const result = assignSaldoPayments(
    [{ id: "julia", name: "Kak Julia (J&T orderan ke 2)", month: "2025-08", paid: 1_850_000, invoice: 1_850_000 }],
    [{ date: "2025-07-29", amount: 1_150_000, label: "DP (Jeep & kak julia)" }],
    ["Pak Suwarno (kaos PE JEEP)"],
  );
  assert.equal(result.matched[0].payments[0].date, "2025-07-29");
  assert.equal(result.matched[0].payments[0].amount, 1_150_000);
});
