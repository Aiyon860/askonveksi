import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { paymentTypeLabel } from "../lib/finance/payment-label.ts";

const root = new URL("..", import.meta.url);

test("label pemasukan Laporan membedakan Deposit, DP, Termin, dan Lunas", () => {
  assert.equal(paymentTypeLabel({ isDeposit: true, paymentTermId: null, kind: "DP" }), "Deposit");
  assert.equal(paymentTypeLabel({ isDeposit: false, paymentTermId: null, kind: "DP" }), "DP");
  assert.equal(paymentTypeLabel({ isDeposit: false, paymentTermId: "term-1", kind: "DP" }), "Termin");
  assert.equal(paymentTypeLabel({ isDeposit: false, paymentTermId: null, kind: "LUNAS" }), "Lunas");
  // Jadwal DEPOSIT lama tanpa flag isDeposit tetap tampil sebagai Deposit.
  assert.equal(paymentTypeLabel({ isDeposit: false, paymentTermId: null, kind: "DEPOSIT" }), "Deposit");
  // Flag deposit menang atas jenis transaksi lain.
  assert.equal(paymentTypeLabel({ isDeposit: true, paymentTermId: "term-1", kind: "LUNAS" }), "Deposit");
});

test("getFinanceReport menambahkan jenis pembayaran ke label pemasukan", async () => {
  const source = await readFile(new URL("lib/finance/report.ts", root), "utf8");

  assert.match(source, /isDeposit: true, paymentTermId: true/);
  assert.match(source, /payment: \{ select: \{ kind: true/);
  assert.match(source, /paymentTypeLabel\(\{ isDeposit: item\.isDeposit, paymentTermId: item\.paymentTermId, kind: item\.payment\.kind \}\)/);
  assert.match(source, /`\$\{order\.snapshotCompanyName \?\? order\.snapshotCustomerName\} · \$\{order\.purchaseOrder\.productName\} · \$\{type\}`/);
});
