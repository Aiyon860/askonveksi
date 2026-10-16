import assert from "node:assert/strict";
import test from "node:test";

import { calculateInvoiceLines, defaultInvoiceItemDescription } from "../lib/crm/invoice-calculation.ts";

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

function calculateWithAddons() {
  return calculateInvoiceLines(
    [{
      purchaseOrderSizeId: "po-size-1",
      productName: "Jaket Polirevo",
      size: "XL",
      sleeveLength: "PANJANG",
      description: "Jaket Polirevo lengan panjang ukuran XL",
      quantity: 2,
      unitPrice: "100000",
      discountPercent: "10",
      addons: [{ label: "Kerah", unitAmount: "10000" }],
    }],
    "10",
  );
}

test("add on per baris dikali qty dan ikut diskon", () => {
  const result = calculateWithAddons();
  // gross = 2 × 100.000 + 2 × 10.000 = 220.000; diskon 10% = 22.000; total 198.000 → 198.000.
  assert.equal(result.items[0].addonGross.toString(), "20000");
  assert.equal(result.items[0].grossAmount.toString(), "220000");
  assert.equal(result.items[0].discountAmount.toString(), "22000");
  assert.equal(result.items[0].total.toString(), "198000");
  assert.equal(result.items[0].addons.length, 1);
  assert.equal(result.items[0].addons[0].total.toString(), "20000");
  assert.equal(result.subtotal.toString(), "220000");
  assert.equal(result.total.toString(), "198000");
});

test("add on ikut kena pajak sebelum pembulatan", () => {
  const result = calculateInvoiceLines(
    [{
      purchaseOrderSizeId: "po-size-1",
      productName: "Jaket Polirevo",
      size: "XL",
      sleeveLength: "PANJANG",
      description: "Jaket",
      quantity: 1,
      unitPrice: "100000",
      discountPercent: "0",
      addons: [{ label: "Kerah", unitAmount: "10000" }],
    }],
    "0",
    "10",
  );
  // gross 110.000 + pajak 10% = 121.000 → tetap 121.000.
  assert.equal(result.taxAmount.toString(), "11000");
  assert.equal(result.total.toString(), "121000");
});

test("baris tanpa add on tidak berubah perilakunya", () => {
  const result = calculate("100000", "10");
  assert.equal(result.items[0].addons.length, 0);
  assert.equal(result.items[0].addonGross.toString(), "0");
  assert.equal(result.items[0].grossAmount.toString(), "100000");
});

test("deskripsi default aksesoris tanpa ukuran dan lengan", () => {
  assert.equal(defaultInvoiceItemDescription("Topi Polirevo", "PENDEK", "XS", true), "Topi Polirevo");
  assert.equal(
    defaultInvoiceItemDescription("Jaket Polirevo", "PANJANG", "S", false),
    "Jaket Polirevo lengan panjang ukuran S",
  );
  assert.equal(
    defaultInvoiceItemDescription("Jaket Polirevo", "PENDEK", "S", false),
    "Jaket Polirevo lengan pendek ukuran S",
  );
});
