import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { calculateInvoiceLines } from "../lib/crm/invoice-calculation.ts";

const D = (value) => new Prisma.Decimal(value);

function checkItem(item, { quantity, unitPrice, discountPercent, profitPercent }) {
  const gross = D(unitPrice).mul(quantity).toDecimalPlaces(2);
  const profitAmount = gross.mul(D(profitPercent)).div(100).toDecimalPlaces(2);
  const beforeDiscount = gross.add(profitAmount);
  const discountAmount = beforeDiscount.mul(D(discountPercent)).div(100).toDecimalPlaces(2);
  const total = beforeDiscount.sub(discountAmount).toDecimalPlaces(2);
  assert.equal(item.grossAmount.toString(), gross.toString(), "grossAmount = ROUND(qty * price, 2)");
  assert.equal(item.discountAmount.toString(), discountAmount.toString(), "discountAmount matches CHECK formula");
  assert.equal(item.profitAmount.toString(), profitAmount.toString(), "profitAmount matches CHECK formula");
  assert.equal(item.total.toString(), total.toString(), "total = (gross + profit) - discount");
  assert.equal(item.subtotal.toString(), total.toString(), "subtotal = total (InvoiceItem_charges_valid)");
  assert.equal(
    item.subtotal.gte(0) && item.quantity > 0,
    true,
    "basic guards hold",
  );
}

function runCase(items, profitPercent, discountPercent = "0") {
  return calculateInvoiceLines(
    items.map((item, index) => ({
      purchaseOrderSizeId: `po-size-${index}`,
      productName: "PDL",
      size: "L",
      sleeveLength: "PENDEK",
      description: `PDL lengan pendek ukuran L`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    profitPercent,
    discountPercent,
  );
}

test("invoice tanpa diskon dan keuntungan memenuhi CHECK", () => {
  const result = runCase([{ quantity: 1, unitPrice: "120000" }], "0");
  checkItem(result.items[0], { quantity: 1, unitPrice: "120000", discountPercent: "0", profitPercent: "0" });
  assert.equal(result.subtotal.toString(), "120000");
  assert.equal(result.total.toString(), "120000");
});

test("invoice dengan diskon memenuhi CHECK", () => {
  const result = runCase([{ quantity: 2, unitPrice: "75000" }], "0", "10");
  checkItem(result.items[0], { quantity: 2, unitPrice: "75000", discountPercent: "10", profitPercent: "0" });
});

test("keuntungan dihitung sebelum diskon", () => {
  const result = runCase([{ quantity: 1, unitPrice: "120000" }], "11");
  checkItem(result.items[0], { quantity: 1, unitPrice: "120000", discountPercent: "0", profitPercent: "11" });
});

test("diskon + keuntungan multi-baris dengan pecahan memenuhi CHECK", () => {
  const inputs = [
    { quantity: 3, unitPrice: "99999" },
    { quantity: 1, unitPrice: "120000" },
  ];
  const result = runCase(inputs, "11", "7.5");
  checkItem(result.items[0], { ...inputs[0], discountPercent: "7.5", profitPercent: "11" });
  checkItem(result.items[1], { ...inputs[1], discountPercent: "7.5", profitPercent: "11" });
  assert.equal(result.items[0].discountPercent.toString(), result.items[1].discountPercent.toString(), "satu diskon berlaku untuk semua ukuran");
  const expectedSubtotal = D("99999").mul(3).add(D("120000")).toString();
  assert.equal(result.subtotal.toString(), expectedSubtotal, "header subtotal = jumlah gross");
});

test("diskon 100% menghasilkan total nol yang valid", () => {
  const result = runCase([{ quantity: 1, unitPrice: "50000" }], "10", "100");
  assert.equal(result.items[0].total.toString(), "0");
  assert.equal(result.items[0].subtotal.toString(), "0");
});

test("total invoice dibulatkan ke puluhan dengan digit satuan 1-5 turun", () => {
  const down = runCase([{ quantity: 1, unitPrice: "215155.84" }], "0");
  const up = runCase([{ quantity: 1, unitPrice: "215156" }], "0");
  assert.equal(down.total.toString(), "215150");
  assert.equal(up.total.toString(), "215160");
});

test("keuntungan dan diskon di atas 100% ditolak dengan pesan jelas", () => {
  assert.throws(
    () => runCase([{ quantity: 1, unitPrice: "10000" }], "101"),
    /Keuntungan maksimal 100%/,
  );
  assert.throws(
    () => runCase([{ quantity: 1, unitPrice: "10000" }], "0", "101"),
    /Diskon maksimal 100%/,
  );
});
