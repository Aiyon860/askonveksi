import assert from "node:assert/strict";
import test from "node:test";

import { calculateInvoiceLines, defaultInvoiceItemDescription } from "../lib/crm/invoice-calculation.ts";

function line(overrides = {}) {
  return {
    purchaseOrderSizeId: "po-size-1",
    productName: "PDL",
    size: "L",
    sleeveLength: "PENDEK",
    description: "PDL lengan pendek ukuran L",
    quantity: 1,
    unitPrice: "100000",
    ...overrides,
  };
}

const NO_ORDER = { type: "NONE", percent: "0" };

test("diskon per item memakai mode persen", () => {
  const result = calculateInvoiceLines([line({ discountType: "PERCENTAGE", discountPercent: "10" })], NO_ORDER);
  assert.equal(result.items[0].grossAmount.toString(), "100000");
  assert.equal(result.items[0].discountAmount.toString(), "10000");
  assert.equal(result.items[0].discountPercent.toString(), "10");
  assert.equal(result.items[0].total.toString(), "90000");
  assert.equal(result.totalDiscount.toString(), "10000");
  assert.equal(result.total.toString(), "90000");
});

test("diskon total invoice adalah potongan terpisah di atas diskon per baris", () => {
  const result = calculateInvoiceLines([line()], { type: "PERCENTAGE", percent: "10" });
  assert.equal(result.items[0].discountAmount.toString(), "0");
  assert.equal(result.subtotal.toString(), "100000");
  assert.equal(result.discountType, "PERCENTAGE");
  assert.equal(result.discountPercent.toString(), "10");
  assert.equal(result.discountNominal.toString(), "10000");
  assert.equal(result.totalDiscount.toString(), "10000");
  assert.equal(result.total.toString(), "90000");
});

test("diskon nominal per item menurunkan persen secara otomatis", () => {
  const result = calculateInvoiceLines([line({ discountType: "NOMINAL", discountNominal: "25000" })], NO_ORDER);
  assert.equal(result.items[0].discountAmount.toString(), "25000");
  assert.equal(result.items[0].discountPercent.toString(), "25");
  assert.equal(result.items[0].total.toString(), "75000");
});

test("diskon nominal melebihi nilai dasar ditolak", () => {
  assert.throws(() => calculateInvoiceLines([line({ discountType: "NOMINAL", discountNominal: "150000" })], NO_ORDER), /melebihi nilai dasar/);
});

test("total invoice dibulatkan ke kelipatan Rp500 terdekat dengan nilai tengah turun", () => {
  assert.equal(calculateInvoiceLines([line({ unitPrice: "84870" })], NO_ORDER).total.toString(), "85000");
  assert.equal(calculateInvoiceLines([line({ unitPrice: "84450" })], NO_ORDER).total.toString(), "84500");
  assert.equal(calculateInvoiceLines([line({ unitPrice: "84250" })], NO_ORDER).total.toString(), "84000");
});

test("diskon di atas 100 persen ditolak", () => {
  assert.throws(() => calculateInvoiceLines([line()], { type: "PERCENTAGE", percent: "101" }), /Diskon total maksimal 100%/);
  assert.throws(() => calculateInvoiceLines([line({ discountType: "PERCENTAGE", discountPercent: "101" })], NO_ORDER), /Diskon per item maksimal 100%/);
});

test("add on punya qty sendiri: sebagian pcs saja yang kena", () => {
  // 2 Kemeja 1 baris, add on qty 1 → hanya 1 pcs yang kena add on.
  const result = calculateInvoiceLines([
    line({ quantity: 2, addons: [{ label: "Kerah", unitAmount: "10000", qty: 1 }] }),
  ], NO_ORDER);
  assert.equal(result.items[0].addonGross.toString(), "10000");
  assert.equal(result.items[0].grossAmount.toString(), "210000");
  assert.equal(result.items[0].addons[0].qty, 1);
  assert.equal(result.items[0].addons[0].total.toString(), "10000");
  assert.equal(result.subtotal.toString(), "210000");
});

test("add on tanpa qty memakai default 1", () => {
  const result = calculateInvoiceLines([
    line({ quantity: 2, addons: [{ label: "Kerah", unitAmount: "10000" }] }),
  ], NO_ORDER);
  assert.equal(result.items[0].addons[0].qty, 1);
  assert.equal(result.items[0].addonGross.toString(), "10000");
});

test("add on qty penuh mengikuti jumlah pcs baris", () => {
  const result = calculateInvoiceLines([
    line({ quantity: 2, addons: [{ label: "Kerah", unitAmount: "10000", qty: 2 }] }),
  ], NO_ORDER);
  assert.equal(result.items[0].addonGross.toString(), "20000");
});

test("add on qty di bawah 1 ditolak", () => {
  assert.throws(() => calculateInvoiceLines([line({ addons: [{ label: "Kerah", unitAmount: "10000", qty: 0 }] })], NO_ORDER), /Qty add on minimal 1/);
});

test("add on ikut diskon per baris dan pajak sebelum pembulatan", () => {
  const result = calculateInvoiceLines(
    [line({ quantity: 2, discountType: "PERCENTAGE", discountPercent: "10", addons: [{ label: "Kerah", unitAmount: "10000", qty: 2 }] })],
    { type: "PERCENTAGE", percent: "10" },
    "10",
  );
  // gross 220.000 → diskon item 10% = 22.000 → total baris 198.000
  // diskon total 10% = 19.800 → dasar pajak 178.200 → pajak 10% = 17.820 → total 196.020 → dibulatkan 196.000
  assert.equal(result.items[0].grossAmount.toString(), "220000");
  assert.equal(result.items[0].discountAmount.toString(), "22000");
  assert.equal(result.items[0].total.toString(), "198000");
  assert.equal(result.discountNominal.toString(), "19800");
  assert.equal(result.taxAmount.toString(), "17820");
  assert.equal(result.total.toString(), "196000");
});

test("baris tanpa add on tidak berubah perilakunya", () => {
  const result = calculateInvoiceLines([line({ discountType: "PERCENTAGE", discountPercent: "10" })], NO_ORDER);
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
