import assert from "node:assert/strict";
import test from "node:test";

import { calculateInvoiceLines } from "../lib/crm/invoice-calculation.ts";

function calculate(unitPrice, discountPercent = "0") {
  return calculateInvoiceLines([{ purchaseOrderSizeId: "po-size-1", productName: "PDL", size: "L", sleeveLength: "PENDEK", description: "PDL lengan pendek ukuran L", quantity: 1, unitPrice }], discountPercent);
}

test("invoice menghitung harga kali qty dikurangi diskon tanpa keuntungan", () => {
  const result = calculate("100000", "10");
  assert.equal(result.items[0].grossAmount.toString(), "100000");
  assert.equal(result.items[0].discountAmount.toString(), "10000");
  assert.equal(result.items[0].total.toString(), "90000");
  assert.equal(result.total.toString(), "90000");
});

test("total invoice dibulatkan ke kelipatan Rp500 terdekat dengan nilai tengah turun", () => {
  assert.equal(calculate("84870").total.toString(), "85000");
  assert.equal(calculate("84450").total.toString(), "84500");
  assert.equal(calculate("84250").total.toString(), "84000");
});

test("diskon di atas 100 persen ditolak", () => {
  assert.throws(() => calculate("10000", "101"), /Diskon maksimal 100%/);
});
