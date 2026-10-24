import assert from "node:assert/strict";
import test from "node:test";

import { calculateInvoiceLines, defaultInvoiceItemDescription } from "../lib/crm/invoice-calculation.ts";
import { groupPurchaseOrderInvoiceItems } from "../lib/crm/invoice-grouping.ts";

function line(overrides = {}) {
  return {
    purchaseOrderItemId: "po-item-1",
    productName: "PDL",
    size: "",
    sleeveLength: null,
    description: "",
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

test("Add On global punya qty sendiri: sebagian pcs saja yang kena", () => {
  // 2 Kemeja 1 baris, add on qty 1 → hanya 1 pcs yang kena add on.
  const result = calculateInvoiceLines(
    [line({ quantity: 2 })],
    NO_ORDER,
    "0",
    [{ label: "Kerah", unitAmount: "10000", qty: 1 }],
  );
  assert.equal(result.items[0].grossAmount.toString(), "200000");
  assert.equal(result.addonGross.toString(), "10000");
  assert.equal(result.addons[0].qty, 1);
  assert.equal(result.addons[0].total.toString(), "10000");
  assert.equal(result.subtotal.toString(), "210000");
  assert.equal(result.total.toString(), "210000");
});

test("Add On global tanpa qty memakai default 1", () => {
  const result = calculateInvoiceLines(
    [line({ quantity: 2 })],
    NO_ORDER,
    "0",
    [{ label: "Kerah", unitAmount: "10000" }],
  );
  assert.equal(result.addons[0].qty, 1);
  assert.equal(result.addonGross.toString(), "10000");
  assert.equal(result.subtotal.toString(), "210000");
});

test("Add On global qty penuh mengikuti jumlah pcs", () => {
  const result = calculateInvoiceLines(
    [line({ quantity: 2 })],
    NO_ORDER,
    "0",
    [{ label: "Kerah", unitAmount: "10000", qty: 2 }],
  );
  assert.equal(result.addonGross.toString(), "20000");
  assert.equal(result.subtotal.toString(), "220000");
});

test("Add On global qty di bawah 1 ditolak", () => {
  assert.throws(
    () => calculateInvoiceLines([line()], NO_ORDER, "0", [{ label: "Kerah", unitAmount: "10000", qty: 0 }]),
    /Qty add on minimal 1/,
  );
});

test("Add On global tidak terkena diskon per baris tetapi ikut diskon total dan pajak", () => {
  const result = calculateInvoiceLines(
    [line({ quantity: 2, discountType: "PERCENTAGE", discountPercent: "10" })],
    { type: "PERCENTAGE", percent: "10" },
    "10",
    [{ label: "Kerah", unitAmount: "10000", qty: 2 }],
  );
  // Produk 200.000 → diskon item 20.000 → 180.000.
  // Add On 20.000 (tidak kena diskon item) → subtotal 220.000.
  // Diskon total 10% dari (180.000 + 20.000) = 20.000 → 180.000.
  // Pajak 10% = 18.000 → total 198.000 (sudah kelipatan 500).
  assert.equal(result.items[0].grossAmount.toString(), "200000");
  assert.equal(result.items[0].discountAmount.toString(), "20000");
  assert.equal(result.items[0].total.toString(), "180000");
  assert.equal(result.addonGross.toString(), "20000");
  assert.equal(result.discountNominal.toString(), "20000");
  assert.equal(result.taxAmount.toString(), "18000");
  assert.equal(result.total.toString(), "198000");
});

test("baris tanpa Add On tidak berubah perilakunya", () => {
  const result = calculateInvoiceLines([line({ discountType: "PERCENTAGE", discountPercent: "10" })], NO_ORDER);
  assert.equal(result.addons.length, 0);
  assert.equal(result.addonGross.toString(), "0");
  assert.equal(result.items[0].grossAmount.toString(), "100000");
  assert.equal(result.items[0].total.toString(), "90000");
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

test("produk PO digabung: semua ukuran dan lengan menjadi satu baris dengan qty total", () => {
  const groups = groupPurchaseOrderInvoiceItems({
    productName: "Kemeja",
    garmentType: "NON_JERSEY",
    items: [{ id: "item-1", name: "Kemeja", garmentType: "NON_JERSEY" }],
    sizes: [
      { itemId: "item-1", quantity: 1 },
      { itemId: "item-1", quantity: 2 },
    ],
  });
  assert.deepEqual(groups, [{
    key: "item-1",
    purchaseOrderItemId: "item-1",
    productName: "Kemeja",
    quantity: 3,
    isAccessory: false,
  }]);
});

test("produk PO berbeda tetap menjadi baris invoice terpisah", () => {
  const groups = groupPurchaseOrderInvoiceItems({
    productName: "Seragam",
    garmentType: "NON_JERSEY",
    items: [
      { id: "item-1", name: "Kemeja", garmentType: "NON_JERSEY" },
      { id: "item-2", name: "Topi", garmentType: "AKSESORI" },
    ],
    sizes: [
      { itemId: "item-1", quantity: 1 },
      { itemId: "item-2", quantity: 2 },
    ],
  });
  assert.deepEqual(groups.map((group) => [group.productName, group.quantity, group.isAccessory]), [
    ["Kemeja", 1, false],
    ["Topi", 2, true],
  ]);
});

test("PO lama tanpa itemId tetap dapat dibuatkan satu baris invoice", () => {
  const groups = groupPurchaseOrderInvoiceItems({
    productName: "Kaos Lama",
    garmentType: "NON_JERSEY",
    sizes: [
      { quantity: 1 },
      { quantity: 1 },
    ],
  });
  assert.deepEqual(groups, [{
    key: "__legacy__",
    purchaseOrderItemId: "",
    productName: "Kaos Lama",
    quantity: 2,
    isAccessory: false,
  }]);
});
