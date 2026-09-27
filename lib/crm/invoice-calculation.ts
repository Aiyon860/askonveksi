import { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

export type InvoicePricingInput = {
  purchaseOrderSizeId: string;
  productName: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG";
  description: string;
  quantity: number;
  unitPrice: string;
};

export function roundInvoiceTotal(value: Prisma.Decimal) {
  return value.div(500).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_DOWN).mul(500);
}

export function calculateInvoiceLines(items: InvoicePricingInput[], discountPercent: string) {
  const orderDiscountPercent = new Prisma.Decimal(discountPercent);
  if (orderDiscountPercent.gt(100)) throw new UserFacingError("Diskon maksimal 100%.");

  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);

    const grossAmount = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const discountAmount = grossAmount.mul(orderDiscountPercent).div(100).toDecimalPlaces(2);
    const total = grossAmount.sub(discountAmount);

    return {
      position,
      productName: item.productName,
      size: item.size,
      sleeveLength: item.sleeveLength,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      grossAmount,
      discountPercent: orderDiscountPercent,
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

  const total = roundInvoiceTotal(summary.total);
  const roundingAdjustment = total.sub(summary.total);
  return {
    items: calculatedItems,
    subtotal: summary.subtotal,
    totalDiscount: roundingAdjustment.isNegative() ? summary.totalDiscount.add(roundingAdjustment.abs()) : summary.totalDiscount,
    discountPercent: orderDiscountPercent,
    total,
  };
}
