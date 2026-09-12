import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { calculateInvoiceLines } from "../lib/crm/invoice-calculation.ts";

const D = (value) => new Prisma.Decimal(value);

function checkItem(item, { quantity, unitPrice, discountPercent, taxRate }) {
  const gross = D(unitPrice).mul(quantity).toDecimalPlaces(2);
  const discountAmount = gross.mul(D(discountPercent)).div(100).toDecimalPlaces(2);
  const taxable = gross.sub(discountAmount);
  const taxAmount = taxable.mul(D(taxRate)).div(100).toDecimalPlaces(2);
  const total = taxable.add(taxAmount).toDecimalPlaces(2);
  assert.equal(item.grossAmount.toString(), gross.toString(), "grossAmount = ROUND(qty * price, 2)");
  assert.equal(item.discountAmount.toString(), discountAmount.toString(), "discountAmount matches CHECK formula");
  assert.equal(item.taxAmount.toString(), taxAmount.toString(), "taxAmount matches CHECK formula");
  assert.equal(item.total.toString(), total.toString(), "total = gross - discount + tax");
  assert.equal(item.subtotal.toString(), total.toString(), "subtotal = total (InvoiceItem_charges_valid)");
  assert.equal(
    item.subtotal.gte(0) && item.quantity > 0,
    true,
    "basic guards hold",
  );
}

function runCase(items, taxRate) {
  return calculateInvoiceLines(
    items.map((item, index) => ({
      purchaseOrderSizeId: `po-size-${index}`,
      productName: "PDL",
      size: "L",
      sleeveLength: "PENDEK",
      description: `PDL lengan pendek ukuran L`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    })),
    taxRate,
  );
}

test("invoice tanpa diskon dan pajak memenuhi CHECK", () => {
  const result = runCase([{ quantity: 1, unitPrice: "120000", discountPercent: "0" }], "0");
  checkItem(result.items[0], { quantity: 1, unitPrice: "120000", discountPercent: "0", taxRate: "0" });
  assert.equal(result.subtotal.toString(), "120000");
  assert.equal(result.total.toString(), "120000");
});

test("invoice dengan diskon memenuhi CHECK", () => {
  const result = runCase([{ quantity: 2, unitPrice: "75000", discountPercent: "10" }], "0");
  checkItem(result.items[0], { quantity: 2, unitPrice: "75000", discountPercent: "10", taxRate: "0" });
});

test("invoice dengan pajak memenuhi CHECK", () => {
  const result = runCase([{ quantity: 1, unitPrice: "120000", discountPercent: "0" }], "11");
  checkItem(result.items[0], { quantity: 1, unitPrice: "120000", discountPercent: "0", taxRate: "11" });
});

test("diskon + pajak multi-baris dengan pecahan memenuhi CHECK", () => {
  const inputs = [
    { quantity: 3, unitPrice: "99999", discountPercent: "7.5" },
    { quantity: 1, unitPrice: "120000", discountPercent: "0" },
  ];
  const result = runCase(inputs, "11");
  checkItem(result.items[0], { ...inputs[0], taxRate: "11" });
  checkItem(result.items[1], { ...inputs[1], taxRate: "11" });
  const expectedSubtotal = D("99999").mul(3).add(D("120000")).toString();
  assert.equal(result.subtotal.toString(), expectedSubtotal, "header subtotal = jumlah gross");
});

test("diskon 100% menghasilkan total nol yang valid", () => {
  const result = runCase([{ quantity: 1, unitPrice: "50000", discountPercent: "100" }], "10");
  assert.equal(result.items[0].total.toString(), "0");
  assert.equal(result.items[0].subtotal.toString(), "0");
});

test("pajak dan diskon di atas 100% ditolak dengan pesan jelas", () => {
  assert.throws(
    () => runCase([{ quantity: 1, unitPrice: "10000", discountPercent: "0" }], "101"),
    /Pajak maksimal 100%/,
  );
  assert.throws(
    () => runCase([{ quantity: 1, unitPrice: "10000", discountPercent: "101" }], "0"),
    /Diskon per item maksimal 100%/,
  );
});
