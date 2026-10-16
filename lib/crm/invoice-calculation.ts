import { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

export type InvoiceAddonInput = {
  label: string;
  unitAmount: string;
};

export type InvoicePricingInput = {
  purchaseOrderSizeId: string;
  productName: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG";
  description: string;
  quantity: number;
  unitPrice: string;
  discountPercent?: string;
  addons?: InvoiceAddonInput[];
};

export function roundInvoiceTotal(value: Prisma.Decimal) {
  return value.div(500).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_DOWN).mul(500);
}

export function defaultInvoiceItemDescription(productName: string, sleeveLength: "PENDEK" | "PANJANG", size: string, isAccessory: boolean) {
  if (isAccessory) return productName;
  return `${productName} ${sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${size}`;
}

export function calculateInvoiceLines(items: InvoicePricingInput[], discountPercent: string, taxPercent = "0") {
  const orderDiscountPercent = new Prisma.Decimal(discountPercent || "0");
  if (orderDiscountPercent.gt(100)) throw new UserFacingError("Diskon maksimal 100%.");
  const orderTaxPercent = new Prisma.Decimal(taxPercent || "0");
  if (orderTaxPercent.gt(100)) throw new UserFacingError("Pajak maksimal 100%.");

  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const itemDiscountPercent = new Prisma.Decimal(item.discountPercent ?? discountPercent ?? "0");
    if (itemDiscountPercent.gt(100)) throw new UserFacingError("Diskon per item maksimal 100%.");
    const addons = (item.addons ?? []).map((addon, addonPosition) => {
      const addonUnit = new Prisma.Decimal(addon.unitAmount);
      if (addonUnit.isNegative()) throw new UserFacingError("Harga add on tidak boleh negatif.");
      return {
        position: addonPosition,
        label: addon.label.trim(),
        unitAmount: addonUnit,
        total: addonUnit.mul(item.quantity).toDecimalPlaces(2),
      };
    });

    const baseGross = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const addonGross = addons.reduce((sum, addon) => sum.add(addon.total), new Prisma.Decimal(0));
    const grossAmount = baseGross.add(addonGross).toDecimalPlaces(2);
    const discountAmount = grossAmount.mul(itemDiscountPercent).div(100).toDecimalPlaces(2);
    const total = grossAmount.sub(discountAmount);

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
      discountPercent: itemDiscountPercent,
      discountCapAmount: null,
      discountAmount,
      total,
      subtotal: total,
      purchaseOrderSizeId: item.purchaseOrderSizeId,
    };
  });

  const summary = calculatedItems.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal.add(item.grossAmount),
      totalDiscount: acc.totalDiscount.add(item.discountAmount),
      total: acc.total.add(item.total),
    }),
    {
      subtotal: new Prisma.Decimal(0),
      totalDiscount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  );

  const taxAmount = summary.total.mul(orderTaxPercent).div(100).toDecimalPlaces(2);
  const totalBeforeRounding = summary.total.add(taxAmount);
  const total = roundInvoiceTotal(totalBeforeRounding);
  const roundingAdjustment = total.sub(totalBeforeRounding);
  return {
    items: calculatedItems,
    subtotal: summary.subtotal,
    totalDiscount: roundingAdjustment.isNegative() ? summary.totalDiscount.add(roundingAdjustment.abs()) : summary.totalDiscount,
    discountPercent: orderDiscountPercent,
    taxPercent: orderTaxPercent,
    taxAmount,
    total,
  };
}
