import { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

export type InvoiceDiscountType = "NONE" | "NOMINAL" | "PERCENTAGE";

export type InvoiceAddonInput = {
  label: string;
  description?: string;
  unitAmount: string;
  /** Jumlah pcs yang kena add on ini (default 1). Bisa lebih kecil dari qty baris. */
  qty?: string | number;
};

export type InvoicePricingInput = {
  purchaseOrderSizeId: string;
  productName: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG";
  description: string;
  quantity: number;
  unitPrice: string;
  discountType?: InvoiceDiscountType;
  discountPercent?: string;
  discountNominal?: string;
  addons?: InvoiceAddonInput[];
};

export type InvoiceOrderDiscountInput = {
  type?: InvoiceDiscountType;
  percent?: string;
  nominal?: string;
};

export function roundInvoiceTotal(value: Prisma.Decimal) {
  return value.div(500).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_DOWN).mul(500);
}

export function defaultInvoiceItemDescription(productName: string, sleeveLength: "PENDEK" | "PANJANG", size: string, isAccessory: boolean) {
  if (isAccessory) return productName;
  return `${productName} ${sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${size}`;
}

/**
 * Diskon dua mode: user mengisi SATU mode (nominal atau persen), kolom lain dihitung
 * sebagai turunan sehingga keduanya selalu bisa ditampilkan bersama.
 */
function resolveDiscount(
  grossAmount: Prisma.Decimal,
  input: { type?: InvoiceDiscountType; percent?: string; nominal?: string },
  label: string,
) {
  const type: InvoiceDiscountType = input.type ?? "PERCENTAGE";
  if (type === "NOMINAL") {
    const nominal = new Prisma.Decimal(input.nominal || "0");
    if (nominal.isNegative()) throw new UserFacingError(`${label} tidak boleh negatif.`);
    if (nominal.gt(grossAmount)) throw new UserFacingError(`${label} melebihi nilai dasar.`);
    const percent = grossAmount.isZero() ? new Prisma.Decimal(0) : nominal.div(grossAmount).mul(100).toDecimalPlaces(4);
    return { type, percent, nominal, amount: nominal };
  }
  if (type === "NONE") {
    return { type, percent: new Prisma.Decimal(0), nominal: new Prisma.Decimal(0), amount: new Prisma.Decimal(0) };
  }
  const percent = new Prisma.Decimal(input.percent || "0");
  if (percent.isNegative()) throw new UserFacingError(`${label} tidak boleh negatif.`);
  if (percent.gt(100)) throw new UserFacingError(`${label} maksimal 100%.`);
  const amount = grossAmount.mul(percent).div(100).toDecimalPlaces(2);
  return { type, percent, nominal: amount, amount };
}

/** Diskon order lama bisa dikirim sebagai string persen (pemakaian lama/tes). */
function normalizeOrderDiscount(orderDiscount: InvoiceOrderDiscountInput | string | undefined): InvoiceOrderDiscountInput {
  if (typeof orderDiscount === "string") return { type: orderDiscount === "0" ? "NONE" : "PERCENTAGE", percent: orderDiscount };
  return orderDiscount ?? { type: "NONE", percent: "0" };
}

export function calculateInvoiceLines(
  items: InvoicePricingInput[],
  orderDiscount: InvoiceOrderDiscountInput | string = { type: "NONE", percent: "0" },
  taxPercent = "0",
) {
  const order = normalizeOrderDiscount(orderDiscount);
  const orderTaxPercent = new Prisma.Decimal(taxPercent || "0");
  if (orderTaxPercent.gt(100)) throw new UserFacingError("Pajak maksimal 100%.");

  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const addons = (item.addons ?? []).map((addon, addonPosition) => {
      const addonUnit = new Prisma.Decimal(addon.unitAmount);
      if (addonUnit.isNegative()) throw new UserFacingError("Harga add on tidak boleh negatif.");
      const addonQty = Number(addon.qty ?? 1);
      if (!Number.isInteger(addonQty) || addonQty < 1) throw new UserFacingError("Qty add on minimal 1.");
      return {
        position: addonPosition,
        label: addon.label.trim(),
        description: addon.description?.trim() || null,
        unitAmount: addonUnit,
        qty: addonQty,
        total: addonUnit.mul(addonQty).toDecimalPlaces(2),
      };
    });

    const baseGross = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const addonGross = addons.reduce((sum, addon) => sum.add(addon.total), new Prisma.Decimal(0));
    const grossAmount = baseGross.add(addonGross).toDecimalPlaces(2);
    const discount = resolveDiscount(
      grossAmount,
      { type: item.discountType, percent: item.discountPercent, nominal: item.discountNominal },
      "Diskon per item",
    );
    const total = grossAmount.sub(discount.amount);

    return {
      position,
      productName: item.productName,
      size: item.size,
      sleeveLength: item.sleeveLength,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      addons,
      addonGross,
      grossAmount,
      discountType: discount.type,
      discountPercent: discount.percent,
      discountCapAmount: null,
      discountAmount: discount.amount,
      total,
      subtotal: total,
      purchaseOrderSizeId: item.purchaseOrderSizeId,
    };
  });

  const summary = calculatedItems.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal.add(item.grossAmount),
      itemDiscount: acc.itemDiscount.add(item.discountAmount),
      total: acc.total.add(item.total),
    }),
    {
      subtotal: new Prisma.Decimal(0),
      itemDiscount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  );

  // Diskon total invoice adalah potongan terpisah di atas total baris (setelah diskon per item).
  const orderDiscountResolved = resolveDiscount(summary.total, order, "Diskon total");
  const afterDiscount = summary.total.sub(orderDiscountResolved.amount);
  const taxAmount = afterDiscount.mul(orderTaxPercent).div(100).toDecimalPlaces(2);
  const totalBeforeRounding = afterDiscount.add(taxAmount);
  const total = roundInvoiceTotal(totalBeforeRounding);
  const roundingAdjustment = total.sub(totalBeforeRounding);
  const totalDiscount = summary.itemDiscount.add(orderDiscountResolved.amount);
  return {
    items: calculatedItems,
    subtotal: summary.subtotal,
    totalDiscount: roundingAdjustment.isNegative() ? totalDiscount.add(roundingAdjustment.abs()) : totalDiscount,
    discountType: orderDiscountResolved.type,
    discountPercent: orderDiscountResolved.percent,
    discountNominal: orderDiscountResolved.nominal,
    taxPercent: orderTaxPercent,
    taxAmount,
    total,
  };
}
