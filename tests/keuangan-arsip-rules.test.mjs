import assert from "node:assert/strict";
import test from "node:test";

import {
  APRIL_IMPORTED,
  ARCHIVE_PAYMENT_NOTE,
  alreadyImported,
  decidePayment,
  partitionArchive,
  decideSkip,
  balanceBuckets,
  monthGuards,
  phoneAllowed,
} from "../scripts/keuangan-arsip-rules.mjs";

test("pertanyaan yang belum dijawab tidak ikut ditulis", () => {
  assert.equal(decideSkip({ month: "2025-04", name: "Kak Faiz (LATSITARDANUS)", invoice: 116_820_000 }), "tanya-1");
  assert.equal(decideSkip({ month: "2025-04", name: "Kak Faiz (LATSITARDANUS AW)", invoice: 149_860_000 }), "tanya-1");
  assert.equal(decideSkip({ month: "2025-04", name: "Kak Faiz (Tactical)", invoice: 1 }), "tanya-1");
  assert.equal(decideSkip({ month: "2025-04", name: "Kak Revin", invoice: 1 }), "tanya-1");
  assert.equal(decideSkip({ month: "2025-11", name: "Hangry", invoice: 2_304_000 }), "tanya-4");
  assert.equal(decideSkip({ month: "2025-04", name: "KAK YESI (PASHMINA)", invoice: 3_960_000 }), null);
  assert.equal(decideSkip({ month: "2025-11", name: "Bu Ria", invoice: 12_186_000 }), null);
});

test("tanpa kolom bayar dicatat lunas tanggal 1", () => {
  const payment = decidePayment({ month: "2026-05", invoice: 3_150_000, dp: null, sisa: null, lunas: null });
  assert.equal(payment.paidOn, "2026-05-01");
  assert.equal(payment.paid, 3_150_000);
  assert.equal(payment.outstanding, 0);
  assert.equal(payment.kind, "LUNAS");
  assert.equal(payment.note, ARCHIVE_PAYMENT_NOTE);
});

test("kolom sisa tetap menjadi piutang", () => {
  const payment = decidePayment({ month: "2025-04", invoice: 3_960_000, dp: 1_000_000, sisa: 2_960_000, lunas: null });
  assert.equal(payment.paid, 1_000_000);
  assert.equal(payment.outstanding, 2_960_000);
  assert.equal(payment.kind, "DP");
  assert.equal(payment.note, null);
});

test("penjaga total bulan", () => {
  const orders = [
    { month: "2025-04", name: "Order April", invoice: APRIL_IMPORTED, laba: 1, skip: null },
    { month: "2025-04", name: "Kak Faiz (LATSITARDANUS)", invoice: 116_820_000, laba: 0, skip: "tanya-1" },
    { month: "2025-11", name: "Bu Ria", invoice: 10_000_000, laba: 1, skip: null },
    { month: "2025-11", name: "Hangry", invoice: 2_304_000, laba: 0, skip: "tanya-4" },
    { month: "2026-05", name: "Mei", invoice: 133_617_000, laba: 1, skip: null },
    { month: "2026-06", name: "Juni", invoice: 108_126_000, laba: 1, skip: null },
    { month: "2026-08", name: "SAGA Mas Bah", invoice: 215_000, laba: 65_500, skip: null },
    { month: "2026-09", name: "Gibran", invoice: 43_048_000, laba: 4_805_318, skip: null },
  ];
  const checks = monthGuards(orders, 216_794_000 - 215_000);
  const failed = checks.filter((item) => !item.ok).map((item) => item.label);
  assert.deepEqual(failed, []);
  const again = monthGuards(orders.map((order) => ({ ...order, skip: order.skip || "sudah-ada" })), 216_794_000);
  assert.deepEqual(again.filter((item) => !item.ok).map((item) => item.label), []);
});

test("order Agustus yang namanya sudah berubah di database tidak digandakan", () => {
  const existing = {
    keys: new Set(["2026-08|libels tambahan|7510000"]),
    rows: [{ month: "2026-08", name: "Libels tambahan", total: 7_510_000 }],
  };
  assert.equal(alreadyImported({ month: "2026-08", name: "Libels", invoice: 7_510_000 }, existing), true);
  assert.equal(alreadyImported({ month: "2026-08", name: "KOV Motion", invoice: 7_510_000 }, existing), false);
});

test("nominal Agustus yang berubah tidak menjadi invoice kedua", () => {
  const rows = [
    { month: "2026-08", name: "Libels tambahan", total: 7_510_000, invoiceId: "libels" },
    { month: "2026-08", name: "Abraham", total: 14_368_000, invoiceId: "abraham" },
    { month: "2026-08", name: "SAGA Kak Edwin", total: 1_480_000, invoiceId: "edwin" },
    { month: "2026-08", name: "SAGA Kak Ifana", total: 12_388_000, invoiceId: "ifana" },
  ];
  const orders = [
    { month: "2026-08", name: "Libels", invoice: 7_510_000, skip: null },
    { month: "2026-08", name: "Libels tambahan", invoice: 280_000, skip: null },
    { month: "2026-08", name: "Abraham", invoice: 13_936_000, skip: null },
    { month: "2026-08", name: "SAGA Kak Edwin", invoice: 2_800_000, skip: null },
    { month: "2026-08", name: "SAGA Kak Ifana", invoice: 12_388_000, skip: null },
    { month: "2026-08", name: "SAGA Monica (ifana)", invoice: 195_000, skip: null },
    { month: "2026-08", name: "Wahyu", invoice: 13_600_000, skip: null },
  ];
  const result = partitionArchive(orders, rows);
  assert.deepEqual(result.fresh.map((order) => order.name), ["Libels tambahan", "SAGA Monica (ifana)", "Wahyu"]);
  assert.deepEqual(result.revisions.map((item) => [item.invoiceId, item.order.invoice, item.previousTotal]), [
    ["abraham", 13_936_000, 14_368_000],
    ["edwin", 2_800_000, 1_480_000],
  ]);
  assert.equal(result.skipped, 2);
});

test("HPP tidak ada yang negatif", () => {
  const balanced = balanceBuckets({ kain: 100, zipper: 0, jahit: 0, pres: 0, dtfPlastisol: 0, bordir: 0, lainnya: -30 }, 80);
  assert.deepEqual(balanced, { kain: 80, zipper: 0, jahit: 0, pres: 0, dtfPlastisol: 0, bordir: 0, lainnya: 0 });
  assert.equal(balanceBuckets({ kain: 50, lainnya: 0 }, 80).lainnya, 30);
});

test("telepon yang ditahan tidak ditulis ke customer baru", () => {
  assert.equal(phoneAllowed("0812345678982"), false);
  assert.equal(phoneAllowed("085141220140"), false);
  assert.equal(phoneAllowed("081392617723"), true);
  assert.equal(phoneAllowed(""), false);
});
